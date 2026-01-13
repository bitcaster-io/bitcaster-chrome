from pathlib import Path

import cairosvg
import os

SOURCE_FOLDER = Path(__file__).parent.parent / "src/images"
INPUT_FILE = SOURCE_FOLDER / "logos" / "bitcaster.svg"
OUTPUT_FOLDER = SOURCE_FOLDER / "logos"



def convert_svg_to_pngs(svg_path, sizes):
    """
    Converts an SVG file to multiple PNG files of different sizes.

    :param svg_path: Path to the source .svg file
    :param sizes: List of integers representing the desired width/height
    """
    # Get the file name without extension
    base_name = os.path.splitext(svg_path)[0]

    for size in sizes:
        output_name = str(OUTPUT_FOLDER / f"{base_name}_{size}x{size}.png")

        try:
            # CairoSVG allows you to specify output width and height
            cairosvg.svg2png(
                url=svg_path,
                write_to=output_name,
                output_width=size,
                output_height=size
            )
            print(f"Successfully created: {output_name}")
        except Exception as e:
            print(f"Failed to convert {svg_path} to {size}px: {e}")


if __name__ == "__main__":
    # Configuration
    target_svg = str(INPUT_FILE)
    target_sizes = [16, 32, 48, 128, 400]

    if os.path.exists(target_svg):
        convert_svg_to_pngs(target_svg, target_sizes)
    else:
        print(f"Error: {target_svg} not found.")
