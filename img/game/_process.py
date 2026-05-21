"""Nettoie les sprites fournis (suppression du fond) et les redimensionne aux tailles du jeu."""
import os
import pillow_avif  # noqa: F401  (enregistre le décodeur AVIF)
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))


def fit_into(img, target):
    """Renvoie une image RGBA de taille target x target, sprite centré, fond transparent."""
    w, h = img.size
    scale = target / max(w, h)
    new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    canvas.paste(resized, ((target - new_w) // 2, (target - new_h) // 2), resized)
    return canvas


def remove_color_bg(img, bg_rgb, tol=40, feather=True):
    """Met en transparent tout pixel proche de bg_rgb (distance euclidienne)."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    br, bg, bb = bg_rgb
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = ((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2) ** 0.5
            if d < tol:
                px[x, y] = (r, g, b, 0)
            elif d < tol * 1.6 and feather:
                alpha = int(255 * (d - tol) / (tol * 0.6))
                px[x, y] = (r, g, b, min(a, max(0, alpha)))
    return img


def remove_bg_flood(img, bg_rgb, tol=40):
    """Flood fill depuis les 4 coins : préserve les pixels internes
    de même couleur que le fond (reflets, etc.)."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    br, bgc, bb = bg_rgb
    seen = bytearray(w * h)

    def close(r, g, b):
        return ((r - br) ** 2 + (g - bgc) ** 2 + (b - bb) ** 2) ** 0.5 < tol

    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    # ajouter aussi quelques points le long des bords
    for i in range(0, w, max(1, w // 20)):
        stack.append((i, 0))
        stack.append((i, h - 1))
    for j in range(0, h, max(1, h // 20)):
        stack.append((0, j))
        stack.append((w - 1, j))

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        idx = y * w + x
        if seen[idx]:
            continue
        r, g, b, a = px[x, y]
        if not close(r, g, b):
            continue
        seen[idx] = 1
        px[x, y] = (r, g, b, 0)
        stack.append((x + 1, y)); stack.append((x - 1, y))
        stack.append((x, y + 1)); stack.append((x, y - 1))
    return img


def pixelate(img, factor):
    """Sous-échantillonne puis ré-agrandit en NEAREST pour effet pixel art."""
    w, h = img.size
    small = img.resize((max(1, w // factor), max(1, h // factor)), Image.NEAREST)
    return small.resize((w, h), Image.NEAREST)


def sample_corner_color(img):
    """Couleur dominante moyennée sur les 4 coins (10x10 chacun)."""
    img = img.convert("RGB")
    w, h = img.size
    s = min(10, w // 10, h // 10) or 1
    samples = []
    for cx, cy in [(0, 0), (w - s, 0), (0, h - s), (w - s, h - s)]:
        crop = img.crop((cx, cy, cx + s, cy + s))
        samples.extend(list(crop.getdata()))
    r = sum(p[0] for p in samples) // len(samples)
    g = sum(p[1] for p in samples) // len(samples)
    b = sum(p[2] for p in samples) // len(samples)
    return (r, g, b)


def process_player():
    src = Image.open(os.path.join(HERE, "player.png")).convert("RGBA")
    # nettoie tout résidu de fond blanc connecté aux bords (PNG a déjà de l'alpha)
    src = remove_bg_flood(src, (255, 255, 255), tol=30)
    bbox = src.getbbox()
    if bbox:
        src = src.crop(bbox)
    out = fit_into(src, 64)
    # orientation source : nez vers le haut → on garde tel quel (player monte)
    out.save(os.path.join(HERE, "player_clean.png"))
    print(f"player_clean.png OK ({out.size})")


def process_boss():
    src = Image.open(os.path.join(HERE, "boss.png")).convert("RGBA")
    # flood-fill du fond noir depuis les bords
    src = remove_bg_flood(src, (0, 0, 0), tol=35)
    bbox = src.getbbox()
    if bbox:
        src = src.crop(bbox)
    out = fit_into(src, 128)
    # tête-bas pour qu'il vise le joueur situé en bas
    out = out.transpose(Image.FLIP_TOP_BOTTOM)
    # effet pixel art léger
    out = pixelate(out, factor=3)
    out.save(os.path.join(HERE, "boss_clean.png"))
    print(f"boss_clean.png OK ({out.size})")
    print("  [!] Watermarks 'pngtree' diagonaux visibles sur le vaisseau — source a remplacer si possible.")


def process_chaser():
    """Reconstruit le space invader proprement carré par carré à partir d'une grille.
    La source (mosaïque sur mur beige) est trop bruitée pour un détourage automatique."""
    P = (95, 70, 165, 255)    # violet
    T = (90, 195, 180, 255)   # turquoise
    R = (215, 75, 55, 255)    # rouge
    grid = [
        ".PP.....PP.",
        "PPPP...PPPP",
        "PPPPTTTPPPP",
        ".PPTTTTTPP.",
        "..TTRTRTT..",
        "..TTTTTTT..",
        ".TTT.T.TTT.",
        ".T..TTT..T.",
        "..TT...TT..",
    ]
    cell = 6
    w = len(grid[0]) * cell
    h = len(grid) * cell
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    cmap = {'P': P, 'T': T, 'R': R}
    for y, row in enumerate(grid):
        for x, c in enumerate(row):
            if c in cmap:
                col = cmap[c]
                for dy in range(cell):
                    for dx in range(cell):
                        px[x * cell + dx, y * cell + dy] = col
    out = fit_into(img, 64)
    out.save(os.path.join(HERE, "chaser_clean.png"))
    print(f"chaser_clean.png OK ({out.size}) — reconstruit en pixel art")


def process_tank():
    src = Image.open(os.path.join(HERE, "tank.avif")).convert("RGBA")
    print(f"  tank source: {src.size}")
    bg = sample_corner_color(src)
    print(f"  tank bg detecté: {bg}")
    # flood-fill : préserve le reflet blanc interne du dôme
    cleaned = remove_bg_flood(src, bg, tol=50)
    bbox = cleaned.getbbox()
    if bbox:
        cleaned = cleaned.crop(bbox)
    out = fit_into(cleaned, 96)
    out.save(os.path.join(HERE, "tank_clean.png"))
    print(f"tank_clean.png OK ({out.size})")


def process_elite():
    src = Image.open(os.path.join(HERE, "elite.png")).convert("RGBA")
    print(f"  elite source: {src.size}")
    bg = sample_corner_color(src)
    print(f"  elite bg detecté: {bg}")
    cleaned = remove_bg_flood(src, bg, tol=40)
    # nettoie aussi un éventuel fond blanc pur
    cleaned = remove_bg_flood(cleaned, (255, 255, 255), tol=25)
    bbox = cleaned.getbbox()
    if bbox:
        cleaned = cleaned.crop(bbox)
    out = fit_into(cleaned, 64)
    out.save(os.path.join(HERE, "elite_clean.png"))
    print(f"elite_clean.png OK ({out.size})")


def remove_blue_dominant(img):
    """Met en transparent tout pixel où le canal bleu domine (fond bleu/dégradé).
    La carapace étant verte/marron/blanche, ses pixels sont préservés."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # bleu dominant : b > r (large marge) ET b > g
            if b > r + 15 and b > g - 5 and b > 90:
                px[x, y] = (r, g, b, 0)
    return img


def process_carapace():
    """Découpe les 4 frames, supprime tout pixel bleu (fond + dégradé + anti-aliasing),
    sauve 4 fichiers carapace_0..3.png."""
    src = Image.open(os.path.join(HERE, "carapace.png")).convert("RGBA")
    w, h = src.size
    frame_w = w // 4
    print(f"  carapace source: {src.size}, frame_w={frame_w}")
    for i in range(4):
        frame = src.crop((i * frame_w, 0, (i + 1) * frame_w, h))
        cleaned = remove_blue_dominant(frame)
        bbox = cleaned.getbbox()
        if bbox:
            cleaned = cleaned.crop(bbox)
        out = fit_into(cleaned, 32)
        out.save(os.path.join(HERE, f"carapace_{i}.png"))
        print(f"carapace_{i}.png OK ({out.size})")


def process_simple(name, target_size):
    """Détoure un sprite à fond blanc/clair et le redimensionne à target_size."""
    src_path = os.path.join(HERE, f"{name}.png")
    if not os.path.exists(src_path):
        print(f"  [skip] {name}.png absent")
        return
    src = Image.open(src_path).convert("RGBA")
    print(f"  {name} source: {src.size}")
    bg = sample_corner_color(src)
    print(f"  {name} bg détecté: {bg}")
    cleaned = remove_bg_flood(src, bg, tol=40)
    cleaned = remove_bg_flood(cleaned, (255, 255, 255), tol=25)
    bbox = cleaned.getbbox()
    if bbox:
        cleaned = cleaned.crop(bbox)
    out = fit_into(cleaned, target_size)
    out.save(os.path.join(HERE, f"{name}_clean.png"))
    print(f"{name}_clean.png OK ({out.size})")


def process_bullets_and_items():
    """Nettoie les bullets, power-ups et malus (fond blanc, sortie 32x32 sauf bullets)."""
    process_simple("bullet_player", 32)
    process_simple("bullet_enemy", 32)
    for name in ["pu_double", "pu_rapid", "pu_shield", "pu_speed",
                 "mal_slow", "mal_weak", "mal_divide"]:
        process_simple(name, 64)


if __name__ == "__main__":
    process_player()
    process_boss()
    process_chaser()
    process_tank()
    process_elite()
    process_carapace()
    process_bullets_and_items()
    print("\nTerminé.")
