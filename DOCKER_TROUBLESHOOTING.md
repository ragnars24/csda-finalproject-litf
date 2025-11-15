# Docker Troubleshooting Guide

## Rosetta Error on Apple Silicon Macs

If you encounter the error:
```
rosetta error: failed to open elf at /lib64/ld-linux-x86-64.so.2
```

This means Docker Desktop needs to enable Rosetta emulation for x86_64 containers.

### Solution: Enable Rosetta in Docker Desktop

1. **Open Docker Desktop**
2. **Go to Settings** (gear icon)
3. **Navigate to "General"** tab
4. **Check the box**: "Use Rosetta for x86/amd64 emulation on Apple Silicon"
5. **Click "Apply & Restart"**
6. **Wait for Docker Desktop to restart**

After enabling Rosetta, rebuild your images:
```bash
docker compose -f docker-compose.personas.yml build --no-cache
docker compose -f docker-compose.personas.yml up -d
```

### Why This Is Needed

The Docker images are built for `linux/amd64` (x86_64) architecture because:
- Puppeteer's Chrome binaries are primarily available for x86_64
- This ensures consistent behavior across different host systems
- On Apple Silicon Macs, Docker Desktop uses Rosetta to emulate x86_64

### Alternative: Native ARM64 Build (Advanced)

If you want to build natively for ARM64, you would need to:
1. Change `FROM --platform=linux/amd64` to `FROM --platform=linux/arm64` in Dockerfile
2. Ensure Puppeteer can download ARM64 Chrome binaries (may not be available)
3. Remove platform specifications from docker-compose files

**Note**: Puppeteer's Chrome for ARM64 may not be available or may have compatibility issues. Using x86_64 with Rosetta is the recommended approach.

## Other Common Issues

### Containerd Metadata Database Error

If you see:
```
write /var/lib/desktop-containerd/daemon/io.containerd.metadata.v1.bolt/meta.db: input/output error
```

**Solution**: Run the cleanup script:
```bash
./scripts/clean-docker.sh
```

Then restart Docker Desktop completely.

### Chrome Binary Not Found

If Puppeteer can't find Chrome:
1. Check that the build completed successfully
2. Verify Chrome was downloaded during build (check build logs)
3. Rebuild with `--no-cache` flag

### Permission Errors

If you see permission errors:
1. Ensure the Dockerfile properly sets up the node user
2. Check that volumes are mounted correctly
3. Verify file permissions in mounted directories

