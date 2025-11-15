#!/bin/bash
# Docker cleanup script to fix corrupted image blobs and containerd metadata
# Run this script if you encounter:
#   - "blob sha256... input/output error"
#   - "write /var/lib/desktop-containerd/daemon/io.containerd.metadata.v1.bolt/meta.db: input/output error"

echo "🧹 Cleaning Docker storage to fix corrupted blobs and metadata..."
echo ""

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "⚠️  Docker is not running or not accessible."
    echo "   Please start Docker Desktop and try again."
    echo ""
    exit 1
fi

# Stop all running containers
echo "1. Stopping running containers..."
docker compose -f docker-compose.personas.yml down 2>/dev/null || true
docker compose down 2>/dev/null || true

# Remove containers
echo "2. Removing containers..."
docker ps -aq | xargs -r docker rm -f 2>/dev/null || true

# Remove images related to this project
echo "3. Removing project images..."
docker images | grep "csda-finalproject-litf" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

# Prune build cache
echo "4. Pruning build cache..."
docker builder prune -af 2>/dev/null || echo "   ⚠️  Build cache prune failed (may need Docker restart)"

# Prune system (optional, more aggressive)
echo "5. Pruning unused Docker resources..."
docker system prune -af --volumes 2>/dev/null || echo "   ⚠️  System prune failed (may need Docker restart)"

echo ""
echo "✅ Docker cleanup complete!"
echo ""

# Check for containerd metadata errors
if docker info 2>&1 | grep -q "containerd\|meta.db\|input/output"; then
    echo "⚠️  WARNING: Docker containerd metadata may be corrupted."
    echo ""
    echo "If you're still seeing 'meta.db: input/output error', try these steps:"
    echo ""
    echo "  Option 1: Restart Docker Desktop (Recommended)"
    echo "    1. Quit Docker Desktop completely (Docker icon → Quit Docker Desktop)"
    echo "    2. Wait 10 seconds"
    echo "    3. Start Docker Desktop again"
    echo "    4. Wait for Docker to fully start, then run this script again"
    echo ""
    echo "  Option 2: Reset Docker Desktop (More aggressive)"
    echo "    1. Open Docker Desktop"
    echo "    2. Go to Settings → Troubleshoot"
    echo "    3. Click 'Clean / Purge data' or 'Reset to factory defaults'"
    echo "    4. Restart Docker Desktop"
    echo ""
    echo "  Option 3: Manual reset (Last resort)"
    echo "    1. Quit Docker Desktop"
    echo "    2. Run: rm -rf ~/Library/Containers/com.docker.docker/Data"
    echo "    3. Start Docker Desktop (it will recreate the data)"
    echo ""
else
    echo "Next steps:"
    echo "  1. Rebuild images: docker compose -f docker-compose.personas.yml build --no-cache"
    echo "  2. Start services: docker compose -f docker-compose.personas.yml up -d"
    echo ""
fi

