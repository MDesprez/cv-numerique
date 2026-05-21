# Sprites du jeu LEO's Mission

## Liste des sprites

| Statut | Nom | Taille finale | Description |
|---|---|---|---|
| ✅ OK | `player_clean.png` | 64 × 64 | Vaisseau du joueur, pointe vers le haut |
| ⚪ SVG inline | *asteroid* | 40 × 40 | Astéroïde rocheux gris (conservé en SVG dans le JS) |
| ✅ OK | `chaser_clean.png` | 64 × 64 | Petit chasseur rapide, reconstruit en pixel art |
| ✅ OK | `tank_clean.png` | 96 × 96 | Gros vaisseau lent et mobile (drift latéral), violet |
| ✅ OK | `elite_clean.png` | 64 × 64 | **Elite / mini-boss** (niveau 6+), tire une carapace Mario Kart visée, drift latéral |
| ✅ OK | `boss_clean.png` | 128 × 128 | **Boss** (niveau 10+, ≥ 1 garanti par niveau), tire 3 missiles en arc |
| ✅ OK | `carapace_0..3.png` | 4 × 32 × 32 | **Munition élite** — 4 frames d'une carapace verte qui tourne |
| ✅ OK | `bullet_player_clean.png` | 32 × 32 | Projectile joueur (bleu/cyan) |
| ✅ OK | `bullet_enemy_clean.png` | 32 × 32 | Projectile ennemi (orange/rouge) |
| ✅ OK | `pu_double_clean.png` | 64 × 64 | **Power-up** — double tir |
| ✅ OK | `pu_rapid_clean.png` | 64 × 64 | **Power-up** — cadence accrue |
| ✅ OK | `pu_shield_clean.png` | 64 × 64 | **Power-up** — bouclier |
| ✅ OK | `pu_speed_clean.png` | 64 × 64 | **Power-up** — vitesse (+0.25, max ×2) |
| ✅ OK | `mal_slow_clean.png` | 64 × 64 | **Malus** — ralentissement (-0.25, min ×0.5) |
| ✅ OK | `mal_weak_clean.png` | 64 × 64 | **Malus** — cadence de tir réduite |
| ✅ OK | `mal_divide_clean.png` | 64 × 64 | **Malus** — divise les tirs par 2 (si stack double-tir actif) |

## Conseils

- **Format** : PNG avec transparence (alpha)
- **Style** : pixel art ou flat illustration, vue de dessus
- **Orientation** : tous les vaisseaux orientés vers le haut (joueur) ou le bas (ennemis qui descendent)
- **Marge** : laisser ~10% de marge transparente autour du sprite
- **Power-ups vs malus** : garde un code couleur clair — power-ups en tons froids/lumineux (bleu, cyan, vert),
  malus en tons chauds/sombres (rouge, violet, orange)
