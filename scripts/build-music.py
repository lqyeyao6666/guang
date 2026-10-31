"""Prepare the three CC0 chapter tracks for local, seamless playback.

Run from the project directory: py -3 scripts/build-music.py
Requires NumPy and ffmpeg. Source files and license notes live in
music-preview/github; output is written to public/music.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "music-preview" / "github"
DESTINATION = ROOT / "public" / "music"
SR = 44100
CROSSFADE_SECONDS = 6
AUDIO_BITRATE = "128k"

TRACKS = [
    dict(chapter=1, title="暖阳琴声 · Calm Piano 1", file="chapter-1-vaporware.mp3",
         source="chapter-1-calm-piano-vaporware.mp3", creator="The Cynic Project / cynicmusic",
         source_page="https://opengameart.org/content/calm-piano-1-vaporware", crossfade=True),
    dict(chapter=2, title="梦境薄云 · Heavenly Loop", file="chapter-2-heavenly-loop.mp3",
         source="heavenly-loop-isaiah658.ogg", creator="isaiah658",
         source_page="https://opengameart.org/content/heavenly-loop", crossfade=False),
    dict(chapter=3, title="安静色谱 · Calm Ambient 1", file="chapter-3-calm-ambient-1.mp3",
         source="chapter-3-calm-ambient-1.mp3", creator="The Cynic Project / cynicmusic",
         source_page="https://opengameart.org/content/calm-ambient-1-synthwave-4k", crossfade=True),
]


def run(args, **kwargs):
    return subprocess.run(["ffmpeg", "-y", "-hide_banner", "-nostats", *args],
                          capture_output=True, check=True, **kwargs)


def measure(path):
    result = run(["-i", str(path), "-af", "loudnorm=I=-19:TP=-2:LRA=9:print_format=json",
                  "-f", "null", "NUL"])
    text = result.stderr.decode("utf-8", errors="replace")
    return json.loads(text[text.rfind("{"):text.rfind("}") + 1])


def decode(path):
    result = run(["-i", str(path), "-f", "f32le", "-acodec", "pcm_f32le",
                  "-ar", str(SR), "-ac", "2", "pipe:1"])
    return np.frombuffer(result.stdout, dtype="<f4").copy().reshape(-1, 2)


def make_loop(audio, crossfade):
    if not crossfade:
        return audio.copy(), float(np.max(np.abs(audio[0] - audio[-1])))
    overlap = CROSSFADE_SECONDS * SR
    assert len(audio) > overlap * 4
    # Rotate the intro into the outro and blend both ends, so loop start and end
    # meet at an active part of the recording rather than a fade to silence.
    angle = np.linspace(0, np.pi / 2, overlap, endpoint=False, dtype=np.float32)
    wrap = (audio[-overlap:] * np.cos(angle[:, None]) +
            audio[:overlap] * np.sin(angle[:, None]))
    loop = np.concatenate((audio[overlap:-overlap], wrap), axis=0)
    seam_step = float(np.max(np.abs(loop[0] - loop[-1])))
    assert seam_step < .12, seam_step
    return loop, seam_step


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    manifest = []
    with tempfile.TemporaryDirectory(prefix="warm-light-chapter-music-") as temporary:
        for track in TRACKS:
            source_path = SOURCE / track["source"]
            audio = decode(source_path)
            loop, seam_step = make_loop(audio, track["crossfade"])
            raw = Path(temporary) / f"chapter-{track['chapter']}.wav"
            run(["-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "pipe:0",
                 "-c:a", "pcm_f32le", str(raw)], input=loop.astype("<f4").tobytes())
            info = measure(raw)
            master = ("loudnorm=I=-19:TP=-2:LRA=9:"
                      f"measured_I={info['input_i']}:measured_TP={info['input_tp']}:"
                      f"measured_LRA={info['input_lra']}:measured_thresh={info['input_thresh']}:"
                      f"offset={info['target_offset']}:linear=true")
            output_path = DESTINATION / track["file"]
            run(["-i", str(raw), "-af", master, "-ar", str(SR), "-c:a", "libmp3lame",
                 "-b:a", AUDIO_BITRATE, "-metadata", "title=" + track["title"],
                 "-metadata", "album=暖光小径 · 游戏章节音乐", str(output_path)])
            final = measure(output_path)
            run(["-v", "error", "-i", str(output_path), "-f", "null", "NUL"])
            # Lossy MP3 encoding can shift the integrated measurement slightly,
            # especially on sustained ambient tracks at the delivery bitrate.
            assert abs(float(final["input_i"]) + 19) < .65
            assert float(final["input_tp"]) < -2
            manifest.append(dict(
                chapter=track["chapter"], title=track["title"], creator=track["creator"],
                license="CC0 1.0", sourcePage=track["source_page"], file=output_path.name,
                loopSeconds=len(loop) / SR,
                source="music-preview/github/" + track["source"],
                preparation=(f"44.1 kHz stereo MP3 at {AUDIO_BITRATE}; normalized to -19 LUFS and below -2 dBTP; "
                             + (f"{CROSSFADE_SECONDS}s circular crossfade for a continuous loop."
                                if track["crossfade"] else "source seamless loop retained.")),
                seamSampleStep=seam_step, integratedLufs=float(final["input_i"]),
                truePeakDbtp=float(final["input_tp"]), fullDecode="passed",
                sha256=hashlib.sha256(output_path.read_bytes()).hexdigest()))
            print(f"Ready: {output_path.name} ({len(loop) / SR:.2f}s loop)", flush=True)

    active_files = {track["file"] for track in TRACKS}
    for old in DESTINATION.glob("chapter-*.mp3"):
        if old.name not in active_files:
            old.unlink()
    (DESTINATION / "tracks.json").write_text(json.dumps(
        dict(version=4, source="Three locally packaged CC0 1.0 recordings; see CREDITS.txt.", tracks=manifest),
        indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
