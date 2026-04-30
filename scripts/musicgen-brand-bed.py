"""
NORA — Music bed generator (MusicGen-small en PC-2)

Genera un bed ambient/melódico para una marca y lo guarda en
remotion-nora/public/music/{slug}_ambient_bed.wav

Uso (desde PC-2 workspace):
  python musicgen-brand-bed.py --slug rtk --prompt "cinematic ambient soundtrack..." [--seconds 15]

Si no se pasa --prompt, usa el prompt default por slug del diccionario PROMPTS.

MusicGen-small: ~50 tokens/s @ 32000 Hz mono.
- 5s  ≈ 256 tokens (sting de cierre)
- 15s ≈ 720 tokens (bed para spot ~20s)
- 30s ≈ 1500 tokens (bed largo, calidad puede degradar)

Recomendaciones por la naturaleza de MusicGen-small:
- Mejor con 10-15s. Más allá tiende a perder coherencia.
- Si el bed es ambient con mucho silencio entre notas, el RMS queda bajo
  (mean ~ -38 dB) — usar volume >= 0.55 en Remotion para que se escuche.
- Si el bed es drone constante (ej. dark cinematic), RMS más alto (~-23 dB)
  — volume 0.35-0.45 alcanza.
"""
import argparse
import os
import sys

import torch
from transformers import MusicgenForConditionalGeneration, AutoProcessor
import scipy.io.wavfile

# Prompts default por marca (alineados con identidad_visual)
PROMPTS = {
    "rtk": (
        "cinematic ambient soundtrack, dark atmospheric pad with melodic piano "
        "line floating above, deep low strings, film score underscore, instrumental "
        "only, no vocals, no drums, slow building emotional progression, "
        "industrial cinematic premium"
    ),
    "cemtra": (
        "ambient corporate underscore, warm piano chords with subtle strings pad, "
        "hopeful medical professional feel, instrumental only, no vocals, no drums, "
        "slow melodic flow, healthcare premium documentary"
    ),
    "equos": (
        "ambient corporate background music, warm brass pad with subtle synth, "
        "trust security insurance feel, instrumental only, no vocals, no drums, "
        "confident professional underscore, slow flow"
    ),
    "bac": (
        "ambient road adventure underscore, warm strings pad with subtle brass, "
        "uplifting professional feel, instrumental only, no vocals, no drums, "
        "slow building inspirational flow, premium documentary"
    ),
    "csj": (
        "ambient gentle healthcare underscore, soft piano with warm strings pad, "
        "caring medical professional feel, instrumental only, no vocals, no drums, "
        "slow emotional flow, premium documentary"
    ),
    "meser": (
        "ambient modern tech underscore, clean synth pad with subtle piano, "
        "cool professional feel, instrumental only, no vocals, no drums, "
        "slow chill flow, premium tech corporate"
    ),
    "redagrupa": (
        "ambient warm protective underscore, confident piano with orchestral strings pad, "
        "trustworthy insurance feel, instrumental only, no vocals, no drums, "
        "slow emotional flow, premium documentary"
    ),
    "lareserva": (
        "ambient serene luxury underscore, acoustic guitar fingerpicking with soft pads, "
        "nature resort premium feel, instrumental only, no vocals, no drums, "
        "slow peaceful flow"
    ),
    "solkinest": (
        "ambient fresh wellness underscore, soft synthesizer pads with crystal chimes, "
        "spa relaxation renewal energy, instrumental only, no vocals, no drums, "
        "slow chill flow"
    ),
}

OUT_DIR = "remotion-nora/public/music"
TOKENS_PER_SECOND = 50  # MusicGen-small: ~50 tokens/s


def main():
    parser = argparse.ArgumentParser(description="Generate brand music bed with MusicGen-small")
    parser.add_argument("--slug", required=True, help="Brand slug (rtk, cemtra, equos, etc.)")
    parser.add_argument("--prompt", default=None, help="Custom prompt (overrides default)")
    parser.add_argument("--seconds", type=float, default=15.0, help="Duration in seconds (default 15)")
    parser.add_argument("--out", default=None, help="Output filename (default {slug}_ambient_bed.wav)")
    args = parser.parse_args()

    prompt = args.prompt or PROMPTS.get(args.slug)
    if not prompt:
        sys.exit(f"No default prompt for slug '{args.slug}'. Provide --prompt or add to PROMPTS dict.")

    out_filename = args.out or f"{args.slug}_ambient_bed.wav"
    out_path = os.path.join(OUT_DIR, out_filename)
    max_tokens = int(args.seconds * TOKENS_PER_SECOND)

    print(f"Loading MusicGen-small...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small").to(device)
    processor = AutoProcessor.from_pretrained("facebook/musicgen-small")

    print(f"\n=== {args.slug}_ambient_bed ===")
    print(f"prompt: {prompt}")
    print(f"max_tokens: {max_tokens}  (~{args.seconds}s)")
    print(f"device: {device}")

    inputs = processor(text=[prompt], padding=True, return_tensors="pt").to(device)
    audio = model.generate(**inputs, max_new_tokens=max_tokens)
    samples = audio[0, 0].cpu().numpy()
    sr = model.config.audio_encoder.sampling_rate

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    scipy.io.wavfile.write(out_path, sr, samples)
    dur = len(samples) / sr

    print(f"\nOK: {out_path}")
    print(f"duration: {dur:.2f}s")
    print(f"sample_rate: {sr} Hz")
    print(f"samples: {len(samples)}")
    print("\n=== Done ===")


if __name__ == "__main__":
    main()
