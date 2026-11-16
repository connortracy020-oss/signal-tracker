"""Draws the Signal icons (five bars, four filled = 80% signal) with no third-party libraries."""
import math, struct, zlib, os

ACCENT = (0xB4, 0x53, 0x2A)
CREAM = (0xFA, 0xF7, 0xF1)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def png(path, size, pixel):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            row += bytes(pixel(x + .5, y + .5))
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(os.path.join(OUT, path), 'wb').write(data)


def cov(d):            # anti-aliased coverage from a signed distance (negative = inside)
    return max(0.0, min(1.0, .5 - d))


def capsule_sd(px, py, x, y0, y1, r):   # vertical capsule from y0 (top) to y1 (bottom)
    cy = min(max(py, y0), y1)
    return math.hypot(px - x, py - cy) - r


def make(path, size, rounded, scale):
    s = size / 32.0
    bars = [(5.5, 26, 1), (11, 21, 1), (16.5, 16, 1), (22, 11, 1), (27.5, 6, .35)]   # x, top y, opacity (32-unit grid)
    corner = size * .225
    def pixel(px, py):
        if rounded:
            qx, qy = abs(px - size / 2) - (size / 2 - corner), abs(py - size / 2) - (size / 2 - corner)
            sd = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - corner
            a_bg = cov(sd)
        else:
            a_bg = 1.0
        col = list(ACCENT)          # the bars always sit inside the rounded square, so no premultiplying needed
        for bx, top, op in bars:
            # scale about the center of the 32-grid
            X = (size / 2) + (bx * s - size / 2) * scale
            Y0 = (size / 2) + (top * s - size / 2) * scale
            Y1 = (size / 2) + (26 * s - size / 2) * scale
            rad = 1.6 * s * scale
            c = cov(capsule_sd(px, py, X, Y0 + rad, Y1 - rad, rad)) * op
            if c > 0:
                col = [col[i] * (1 - c) + CREAM[i] * c for i in range(3)]
        return tuple(int(round(v)) for v in col) + (int(round(a_bg * 255)),)
    png(path, size, pixel)


if __name__ == '__main__':
    make('icon-512.png', 512, True, .74)
    make('icon-192.png', 192, True, .74)
    make('icon-maskable-512.png', 512, False, .55)     # full-bleed, mark kept inside the safe zone
    make('apple-touch-icon.png', 180, False, .72)       # iOS rounds the corners itself
    print('icons written')
