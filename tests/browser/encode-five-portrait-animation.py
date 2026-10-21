#!/usr/bin/env python3
"""Encode actual public five-portrait benchmark frames; never interpolate portraits."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import time

import numpy as np
from PIL import GifImagePlugin, Image

WORK = Path(__file__).resolve().parents[2] / "work"
FRAME_SIZE = 256
GRID_SIZE = 8
FORWARD_COUNT = 61
SEQUENCE = list(range(FORWARD_COUNT)) + list(range(FORWARD_COUNT - 2, 0, -1))
DURATIONS = [450 if index in (0, 60) else 50 for index in SEQUENCE]


def gif_structure(path: Path) -> dict:
    """Parse GIF blocks to verify one global table and no local palettes."""
    data = path.read_bytes()
    assert data[:6] in (b"GIF87a", b"GIF89a")
    screen_flags = data[10]
    assert screen_flags & 0x80, "GIF must contain a global color table"
    colors = 2 ** ((screen_flags & 7) + 1)
    offset = 13 + 3 * colors
    images = 0
    local_tables = 0
    while offset < len(data):
        marker = data[offset]
        offset += 1
        if marker == 0x3B:
            break
        if marker == 0x21:
            offset += 1  # Extension label, followed by sub-blocks.
        elif marker == 0x2C:
            descriptor = data[offset:offset + 9]
            assert len(descriptor) == 9
            width = int.from_bytes(descriptor[4:6], "little")
            height = int.from_bytes(descriptor[6:8], "little")
            assert (width, height) == (FRAME_SIZE, FRAME_SIZE)
            image_flags = descriptor[8]
            offset += 9
            if image_flags & 0x80:
                local_tables += 1
                offset += 3 * 2 ** ((image_flags & 7) + 1)
            offset += 1  # LZW minimum code size.
            images += 1
        else:
            raise AssertionError(f"Unexpected GIF block {marker:#x}")
        while True:
            length = data[offset]
            offset += 1
            if not length:
                break
            offset += length
    return {"global_palette_colors": colors, "local_color_tables": local_tables, "image_blocks": images}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--wait-seconds", type=float, default=0)
    args = parser.parse_args()
    deadline = time.monotonic() + args.wait_seconds
    while not args.atlas.exists():
        if time.monotonic() >= deadline:
            raise FileNotFoundError(args.atlas)
        time.sleep(1)
    # A browser download may still be completing its atomic handoff.
    while True:
        try:
            with Image.open(args.atlas) as source:
                source.load()
                assert source.size == (FRAME_SIZE * GRID_SIZE,) * 2, source.size
                if "A" in source.getbands():
                    alpha = source.getchannel("A")
                    for i in range(FORWARD_COUNT):
                        box = (i % GRID_SIZE * FRAME_SIZE, i // GRID_SIZE * FRAME_SIZE,
                               (i % GRID_SIZE + 1) * FRAME_SIZE, (i // GRID_SIZE + 1) * FRAME_SIZE)
                        assert alpha.crop(box).getextrema() == (255, 255), f"Rendered frame {i} must be opaque"
                atlas = source.convert("RGB")
            break
        except (OSError, AssertionError):
            if time.monotonic() >= deadline:
                raise
            time.sleep(1)
    frames = [atlas.crop((i % GRID_SIZE * FRAME_SIZE, i // GRID_SIZE * FRAME_SIZE,
                          (i % GRID_SIZE + 1) * FRAME_SIZE, (i // GRID_SIZE + 1) * FRAME_SIZE))
              for i in range(FORWARD_COUNT)]
    # A single shared palette is trained on every actual frame. Thumbnailing
    # only reduces palette-training work: output frames use untouched crops.
    training = Image.new("RGB", (GRID_SIZE * 256, GRID_SIZE * 256))
    for i, frame in enumerate(frames):
        training.paste(frame.resize((256, 256), Image.Resampling.BOX), (i % GRID_SIZE * 256, i // GRID_SIZE * 256))
    palette = training.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    shared_palette = palette.getpalette()[:255 * 3] + [255, 255, 255]
    palette.putpalette(shared_palette)
    indexed = []
    for frame in frames:
        quantized = frame.quantize(palette=palette, dither=Image.Dither.NONE)
        indices = np.array(quantized)
        white = np.all(np.asarray(frame) == 255, axis=-1)
        indices[white] = 255
        result = Image.fromarray(indices)
        result.putpalette(shared_palette)
        indexed.append(result)
    assert all(frame.getpalette() == indexed[0].getpalette() for frame in indexed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".tmp.gif")
    # Writing individual image blocks preserves all 120 scheduled frames even
    # if quantization makes two neighbouring eased endpoint frames identical.
    header, _ = GifImagePlugin.getheader(indexed[0], info={"loop": 0, "optimize": False})
    with temporary.open("wb") as output:
        for part in header:
            output.write(part)
        # Credits travel with the GIF when it is shared independently.
        credit = ("Experimental 3D morph, closed-mouth--open-laugh. Adapted photographs: "
                  "Daniel Torok / The White House (public domain); Basile Morin (CC BY-SA 4.0). "
                  "Crop, white matting, 3D projection and interpolation. Adaptation CC BY-SA 4.0. "
                  "Sources and license: https://github.com/bvking/Make-puzzle-of-who-you-are/blob/"
                  "feat/adaptive-chin-transition-20261014/Taquin%20deux%20visages%20interpol%C3%A9s/qa/internet-five/ATTRIBUTION.md").encode("utf-8")
        output.write(b"\x21\xfe")
        for start in range(0, len(credit), 255):
            block = credit[start:start + 255]
            output.write(bytes([len(block)]) + block)
        output.write(b"\x00")
        for index, duration in zip(SEQUENCE, DURATIONS):
            for part in GifImagePlugin.getdata(indexed[index], duration=duration, disposal=1, include_color_table=False):
                output.write(part)
        output.write(b";")
    temporary.replace(args.output)
    structure = gif_structure(args.output)
    assert structure == {"global_palette_colors": 256, "local_color_tables": 0, "image_blocks": len(SEQUENCE)}
    errors = []
    with Image.open(args.output) as result:
        assert result.n_frames == len(SEQUENCE)
        assert result.size == (FRAME_SIZE, FRAME_SIZE)
        assert result.info.get("loop") == 0
        actual_durations = []
        for position, index in enumerate(SEQUENCE):
            result.seek(position)
            actual_durations.append(result.info["duration"])
            actual = result.convert("RGB")
            assert actual.tobytes() == indexed[index].convert("RGB").tobytes(), position
        assert actual_durations == DURATIONS
    validations = []
    for index, name in [(0, "A"), (30, "midpoint"), (60, "B")]:
        path = WORK / f"five-public-validation-{index:03d}-{name}.png"
        frames[index].save(path)
        validations.append(str(path))
        before = np.asarray(frames[index], dtype=np.int16)
        after = np.asarray(indexed[index].convert("RGB"), dtype=np.int16)
        errors.append({"frame": index, "palette_mean_absolute_error": float(np.abs(before - after).mean())})
    print(json.dumps({"output": str(args.output), "size": [FRAME_SIZE, FRAME_SIZE],
                      "frames": len(SEQUENCE), "forward_frames": FORWARD_COUNT,
                      "duration_ms": sum(DURATIONS), "endpoint_holds_ms": 450,
                      "ordinary_frame_duration_ms": 50, "infinite_loop": True,
                      "bytes": args.output.stat().st_size,
                      "sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
                      **structure, "validation_pngs": validations, "quantization": errors}, indent=2), flush=True)


if __name__ == "__main__":
    main()
