"""Shared material library so every model uses the same surfaces."""
import core
import tex


def M(key):
    f = _LIB[key]
    return f()


def _wood_planks():
    return core.mat("kayu_papan", tex.wood("kayu_papan", planks=6, seed=2,
                                           base=(0.47, 0.31, 0.18), dark=(0.25, 0.15, 0.08)),
                    rough=0.75)


def _wood_beam():
    return core.mat("kayu_balok", tex.wood("kayu_balok", seed=4, base=(0.40, 0.26, 0.15),
                                           dark=(0.2, 0.12, 0.07)), rough=0.8)


def _wood_dark():
    return core.mat("kayu_tua", tex.wood("kayu_tua", seed=6, planks=4, base=(0.28, 0.17, 0.10),
                                         dark=(0.13, 0.08, 0.05), weather=0.25), rough=0.7)


def _wood_old_grey():
    return core.mat("kayu_lapuk", tex.wood("kayu_lapuk", seed=8, planks=5, base=(0.46, 0.41, 0.35),
                                           dark=(0.25, 0.21, 0.17), weather=0.8), rough=0.85)


def _hull_paint():
    return core.mat("cat_lambung", tex.wood("cat_lambung", seed=10, planks=5,
                                            paint=(0.08, 0.34, 0.40), paint_wear=0.22), rough=0.55)


def _hull_white():
    return core.mat("cat_putih", tex.wood("cat_putih", seed=12, planks=2,
                                          paint=(0.86, 0.85, 0.8), paint_wear=0.18), rough=0.5)


def _hull_red():
    return core.mat("cat_merah", tex.wood("cat_merah", seed=14, planks=1,
                                          paint=(0.72, 0.16, 0.10), paint_wear=0.2), rough=0.5)


def _hull_yellow():
    return core.mat("cat_kuning", tex.wood("cat_kuning", seed=16, planks=1,
                                           paint=(0.88, 0.66, 0.16), paint_wear=0.25), rough=0.5)


def _jukung_green():
    return core.mat("cat_hijau", tex.wood("cat_hijau", seed=18, planks=5,
                                          paint=(0.18, 0.42, 0.2), paint_wear=0.3), rough=0.55)


def _jukung_blue():
    return core.mat("cat_biru", tex.wood("cat_biru", seed=20, planks=5,
                                         paint=(0.12, 0.25, 0.55), paint_wear=0.3), rough=0.55)


def _engine():
    return core.mat("mesin", tex.painted("mesin", (0.2, 0.3, 0.27), seed=22, rough=0.45,
                                         wear=0.18, streaks=0.5, under=(0.25, 0.2, 0.17), metal=0.6),
                    rough=0.45)


def _steel():
    return core.mat("baja", tex.metal("baja", color=(0.55, 0.56, 0.57), seed=24, rough=0.35,
                                      tarnish=0.5), rough=0.4, metal=1.0)


def _rubber():
    return core.flat("karet", (0.04, 0.04, 0.04), rough=0.85)


def _rope():
    return core.mat("tali", tex.food("tali", (0.62, 0.52, 0.34), spec=0.8, seed=26, grains=24,
                                     grain_col=(0.7, 0.6, 0.42), bumps=0.6), rough=0.9)


def _ampera_red():
    return core.mat("ampera_merah", tex.painted("ampera_merah", (0.62, 0.05, 0.06), size=1024, seed=30,
                                                rough=0.42, wear=0.05, streaks=0.35,
                                                under=(0.35, 0.25, 0.22), panel=4), rough=0.42)


def _concrete():
    return core.mat("beton", tex.concrete("beton"), rough=0.85)


def _asphalt():
    return core.mat("aspal", tex.asphalt("aspal"), rough=0.85)


def _roof_tile():
    return core.mat("genteng", tex.tiles("genteng"), rough=0.75)


def _roof_tile_dark():
    return core.mat("genteng_tua", tex.tiles("genteng_tua", color=(0.42, 0.2, 0.14), seed=33), rough=0.8)


def _roof_green_tile():
    return core.mat("genteng_hijau", tex.tiles("genteng_hijau", color=(0.16, 0.42, 0.34), seed=35),
                    rough=0.55)


def _thatch():
    return core.mat("atap_nipah", tex.thatch("atap_nipah"), rough=0.9)


def _zinc():
    return core.mat("seng", tex.painted("seng", (0.6, 0.6, 0.58), seed=37, rough=0.45, wear=0.25,
                                        streaks=0.6, under=(0.45, 0.28, 0.18), metal=0.7, panel=12),
                    rough=0.45)


def _plaster_white():
    return core.mat("plester_putih", tex.plaster("plester_putih", (0.88, 0.86, 0.8)), rough=0.85)


def _plaster_pink():
    return core.mat("plester_merah_muda", tex.plaster("plester_merah_muda", (0.86, 0.62, 0.6), seed=39,
                                                      stains=0.25), rough=0.8)


def _red_lacquer():
    return core.mat("merah_pilar", tex.painted("merah_pilar", (0.6, 0.05, 0.05), seed=41, rough=0.35,
                                               wear=0.02, streaks=0.15), rough=0.35)


def _jade():
    return core.mat("hijau_giok", tex.painted("hijau_giok", (0.12, 0.45, 0.3), seed=43, rough=0.35,
                                              wear=0.02, streaks=0.1), rough=0.35)


def _gold_trim():
    return core.mat("emas_ornamen", tex.metal("emas_ornamen", color=(0.85, 0.62, 0.22), seed=45,
                                              rough=0.3, tarnish=0.25), rough=0.3, metal=1.0)


def _green_dome():
    return core.mat("kubah_hijau", tex.painted("kubah_hijau", (0.1, 0.5, 0.3), seed=47, rough=0.3,
                                               wear=0.03, streaks=0.2, panel=16), rough=0.3)


def _glass_dark():
    return core.flat("kaca_gelap", (0.05, 0.07, 0.08), rough=0.08, metal=0.0)


def _window_glow():
    return core.flat("jendela_lampu", (0.9, 0.62, 0.32), rough=0.5, emit=(1.0, 0.62, 0.3), emit_strength=0.0)


def _ground():
    return core.mat("tanah", tex.ground("tanah"), rough=0.9)


def _mud():
    return core.mat("lumpur", tex.ground("lumpur", grass=(0.3, 0.26, 0.17), mud=(0.27, 0.21, 0.14), seed=51),
                    rough=0.8)


def _bamboo():
    return core.mat("bambu", tex.bamboo("bambu"), rough=0.5)


def _frond():
    return core.mat("daun_kelapa", tex.frond("daun_kelapa"), clip=True, double=True, rough=0.55)


def _frond_nipa():
    return core.mat("daun_nipah", tex.frond("daun_nipah", seed=57, color=(0.25, 0.42, 0.13)), clip=True,
                    double=True, rough=0.5)


def _trunk():
    return core.mat("batang_kelapa", tex.wood("batang_kelapa", seed=59, base=(0.45, 0.4, 0.33),
                                              dark=(0.26, 0.22, 0.18), weather=0.6), rough=0.9)


def _brass():
    return core.mat("kuningan", tex.metal("kuningan", color=(0.8, 0.58, 0.26), seed=61, rough=0.28,
                                          tarnish=0.4), rough=0.3, metal=1.0)


def _ceramic():
    return core.mat("piring", tex.ceramic("piring"), rough=0.12)


def _ceramic_plain():
    return core.mat("keramik_polos", tex.ceramic("keramik_polos", rim=False), rough=0.12)


def _glass():
    return core.flat("gelas_kaca", (0.85, 0.9, 0.9), rough=0.05, alpha=0.35)


def _songket():
    return core.mat("songket", tex.songket("songket"), rough=0.6)


def _sepra():
    return core.mat("sepra", tex.cloth_floral("sepra"), rough=0.9)


def _paper():
    return core.mat("kertas_tua", tex.paper("kertas_tua"), rough=0.92)


def _leather():
    return core.mat("kulit_sampul", tex.leather("kulit_sampul"), rough=0.6)


def _lamp_glow():
    return core.flat("nyala_pelita", (1.0, 0.7, 0.35), rough=0.5, emit=(1.0, 0.6, 0.25), emit_strength=6.0)


def _sign_plate():
    return core.mat("papan_email", tex.painted("papan_email", (0.07, 0.22, 0.19), seed=63, rough=0.3,
                                               wear=0.06, streaks=0.2), rough=0.3)


def _sign_face():
    # The face carries a runtime CanvasTexture in three.js; neutral here.
    return core.flat("papan_muka", (0.07, 0.22, 0.19), rough=0.35)


_LIB = {
    "wood_planks": _wood_planks, "wood_beam": _wood_beam, "wood_dark": _wood_dark,
    "wood_grey": _wood_old_grey, "hull": _hull_paint, "hull_white": _hull_white,
    "hull_red": _hull_red, "hull_yellow": _hull_yellow, "jukung_green": _jukung_green,
    "jukung_blue": _jukung_blue, "engine": _engine, "steel": _steel, "rubber": _rubber,
    "rope": _rope, "ampera_red": _ampera_red, "concrete": _concrete, "asphalt": _asphalt,
    "roof_tile": _roof_tile, "roof_tile_dark": _roof_tile_dark, "roof_green": _roof_green_tile,
    "thatch": _thatch, "zinc": _zinc, "plaster_white": _plaster_white,
    "plaster_pink": _plaster_pink, "red_lacquer": _red_lacquer, "jade": _jade,
    "gold": _gold_trim, "green_dome": _green_dome, "glass_dark": _glass_dark,
    "window_glow": _window_glow, "ground": _ground, "mud": _mud, "bamboo": _bamboo,
    "frond": _frond, "frond_nipa": _frond_nipa, "trunk": _trunk, "brass": _brass,
    "ceramic": _ceramic, "ceramic_plain": _ceramic_plain, "glass": _glass,
    "songket": _songket, "sepra": _sepra, "paper": _paper, "leather": _leather,
    "lamp_glow": _lamp_glow, "sign_plate": _sign_plate, "sign_face": _sign_face,
}
