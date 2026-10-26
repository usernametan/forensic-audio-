#!/usr/bin/env bash
# ==============================================================================
# Automated One-Command Installation for Forensic Audio ML Stack
# Supports Linux (Ubuntu/Debian, Fedora, Arch) and macOS
# Automatically configures CUDA if GPU is detected, otherwise installs optimized CPU wheels.
# ==============================================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}   Forensic Audio Platform — Open-Source ML Stack Installer        ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo ""

# 1. Check Python version
PYTHON_BIN=$(which python3 || which python || echo "")
if [ -z "$PYTHON_BIN" ]; then
    echo -e "${RED}[ERROR] python3 not found. Please install Python 3.10 or 3.11.${NC}"
    exit 1
fi

PY_VER=$($PYTHON_BIN -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo -e "${GREEN}[✓] Using Python ${PY_VER} (${PYTHON_BIN})${NC}"

# 2. Check for FFmpeg system dependency
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${YELLOW}[!] FFmpeg is not installed on system PATH.${NC}"
    if command -v apt-get &> /dev/null; then
        echo -e "${CYAN}Attempting to install ffmpeg via apt-get (requires sudo)...${NC}"
        sudo apt-get update && sudo apt-get install -y ffmpeg libsndfile1 || echo -e "${YELLOW}Could not install via sudo. Continuing with Python bundled imageio-ffmpeg...${NC}"
    elif command -v brew &> /dev/null; then
        echo -e "${CYAN}Installing ffmpeg via Homebrew...${NC}"
        brew install ffmpeg libsndfile || true
    else
        echo -e "${YELLOW}Please install FFmpeg manually via your system package manager for full audio container support.${NC}"
    fi
else
    echo -e "${GREEN}[✓] System FFmpeg detected: $(ffmpeg -version | head -n 1)${NC}"
fi

# 3. Detect CUDA vs CPU
echo ""
echo -e "${CYAN}Detecting Hardware & Compute Architecture...${NC}"
HAS_CUDA=false
if command -v nvidia-smi &> /dev/null; then
    if nvidia-smi &> /dev/null; then
        HAS_CUDA=true
        GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1)
        echo -e "${GREEN}[✓] NVIDIA GPU detected: ${GPU_NAME} — Installing CUDA PyTorch${NC}"
    fi
fi

if [ "$HAS_CUDA" = false ]; then
    echo -e "${YELLOW}[i] No active NVIDIA GPU found. Installing CPU-optimized PyTorch build.${NC}"
fi

# 4. Upgrade pip and setuptools
echo ""
echo -e "${CYAN}Upgrading pip and build tools...${NC}"
$PYTHON_BIN -m pip install --upgrade pip setuptools wheel

# 5. Install PyTorch with appropriate index
echo ""
echo -e "${CYAN}Installing PyTorch & Torchaudio...${NC}"
if [ "$HAS_CUDA" = true ]; then
    $PYTHON_BIN -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
else
    $PYTHON_BIN -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

# 6. Install Base + ML Forensic requirements
echo ""
echo -e "${CYAN}Installing Core Backend Requirements...${NC}"
$PYTHON_BIN -m pip install -r backend/requirements.txt

echo ""
echo -e "${CYAN}Installing Open-Source Forensic ML Packages...${NC}"
echo -e "${YELLOW}(Whisper, SpeechBrain, DeepFilterNet, Pyannote, Parselmouth, Transformers)${NC}"
$PYTHON_BIN -m pip install -r backend/requirements-ml.txt

# 7. Check or create .env file
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}[✓] Created .env from .env.example${NC}"
    fi
fi

# 8. Verification test across all 3rd party architectures
echo ""
echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}   Verifying Model Architectures...                                 ${NC}"
echo -e "${CYAN}====================================================================${NC}"

$PYTHON_BIN - << 'EOF'
import sys

modules = [
    ("PyTorch", "torch"),
    ("OpenAI Whisper", "whisper"),
    ("SpeechBrain (ECAPA-TDNN)", "speechbrain"),
    ("DeepFilterNet", "df"),
    ("Pyannote.audio", "pyannote.audio"),
    ("Praat Parselmouth", "parselmouth"),
    ("HuggingFace Transformers", "transformers"),
    ("Librosa", "librosa"),
    ("Soundfile", "soundfile"),
]

passed = 0
for name, mod in modules:
    try:
        __import__(mod)
        print(f"  \033[0;32m[✓]\033[0m {name:<30} SUCCESS")
        passed += 1
    except Exception as e:
        print(f"  \033[0;31m[✗]\033[0m {name:<30} FAILED: {e}")

print("-" * 60)
if passed == len(modules):
    print(f"\033[0;32m[✓] All {passed}/{len(modules)} Forensic 3rd-Party Architectures are ready!\033[0m")
else:
    print(f"\033[1;33m[!] {passed}/{len(modules)} architectures available. Stubs will handle remaining.\033[0m")
EOF

echo ""
echo -e "${GREEN}====================================================================${NC}"
echo -e "${GREEN}   Installation Complete!                                          ${NC}"
echo -e "${GREEN}====================================================================${NC}"
echo ""
echo -e "Next steps for your friend:"
echo -e "1. (Optional for Pyannote Diarization):"
echo -e "   Create a free Hugging Face account, accept terms at https://huggingface.co/pyannote/speaker-diarization-3.1"
echo -e "   and add your token to .env:"
echo -e "   ${CYAN}HF_TOKEN=hf_your_free_token_here${NC}"
echo ""
echo -e "2. Launch the full platform with:"
echo -e "   ${CYAN}npm run dev${NC}"
echo ""
