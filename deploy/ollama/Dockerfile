FROM ollama/ollama:rocm

# Force ROCm to recognise the RDNA2 iGPU on Ryzen 6000 series (gfx1036)
ENV HSA_OVERRIDE_GFX_VERSION=10.3.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
