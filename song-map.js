// song-map.js — Single source of truth for song → album mapping
// Substring matching: title.toLowerCase().includes(key.toLowerCase()) → album
// Keys sorted longest-first within each album to avoid false substring matches.
// "Orphan" = singles/features not belonging to any studio album.
//
// EAS methodology divisors (Chartmasters CSPC):
//   Audio streams  : streams × artist_ratio (1.82) / 1166
//   Video streams  : views / 6750
//   Physical single: sales × 3/10
//   Download single: sales × 1.5/10

const SONG_TO_ALBUM_MAP = {
    // ── JUSTIFIED (2002) ────────────────────────────────────────
    "Like I Love You":       "Justified",
    "Cry Me a River":        "Justified",
    "Rock Your Body":        "Justified",
    "Señorita":              "Justified",
    "Last Night":            "Justified",
    "Take It From Here":     "Justified",
    "Still On My Brain":     "Justified",
    "Take Me Now":           "Justified",   // "(And She Said) Take Me Now" also matches
    "Right For Me":          "Justified",
    "Nothin' Else":          "Justified",
    "Never Again":           "Justified",

    // ── FUTURESEX/LOVESOUNDS (2006) — standard + deluxe ────────
    // ── FUTURESEX/LOVESOUNDS (2006) — standard + deluxe ────────
    "Boutique In Heaven":    "FutureSex/LoveSounds",
    "LoveStoned":            "FutureSex/LoveSounds",
    "I Think She Knows":     "FutureSex/LoveSounds",
    "Losing My Way":         "FutureSex/LoveSounds",
    "What Goes Around":      "FutureSex/LoveSounds",
    "Comes Around":          "FutureSex/LoveSounds",
    "Until The End Of Time": "FutureSex/LoveSounds",
    "Chop Me Up":            "FutureSex/LoveSounds",
    "Summer Love":           "FutureSex/LoveSounds",
    "Sexy Ladies":           "FutureSex/LoveSounds",
    "Damn Girl":             "FutureSex/LoveSounds",
    "FutureSex":             "FutureSex/LoveSounds",
    "SexyBack":              "FutureSex/LoveSounds",
    "My Love":               "FutureSex/LoveSounds",
    "All Over Again":        "FutureSex/LoveSounds",
    "Pose":                  "FutureSex/LoveSounds",
    "Another Song":          "FutureSex/LoveSounds",
    "Set The Mood":          "FutureSex/LoveSounds",

    // ── THE 20/20 EXPERIENCE (2013) — Part 1 ───────────────────
    "Strawberry Bubblegum":  "The 20/20 Experience",
    "Spaceship Coupe":       "The 20/20 Experience",
    "Pusher Love Girl":      "The 20/20 Experience",
    "Don't Hold the Wall":   "The 20/20 Experience",
    "Let the Groove Get In": "The 20/20 Experience",
    "Suit & Tie":            "The 20/20 Experience",
    "That Girl":             "The 20/20 Experience",
    "Mirrors":               "The 20/20 Experience",
    "Tunnel Vision":         "The 20/20 Experience",
    "Body Count":            "The 20/20 Experience",
    "Dress On":              "The 20/20 Experience",
    "Blue Ocean Floor":      "The 20/20 Experience",

    // ── THE 20/20 EXPERIENCE (2013) – 2 of 2 (Part 2) ──────────
    "Take Back the Night":   "The 20/20 Experience – 2 of 2",
    "Only When I Walk Away": "The 20/20 Experience – 2 of 2",
    "Gimme What I Don't Know":"The 20/20 Experience – 2 of 2",
    "Not a Bad Thing":       "The 20/20 Experience – 2 of 2",
    "Drink You Away":        "The 20/20 Experience – 2 of 2",
    "True Blood":            "The 20/20 Experience – 2 of 2",
    "You Got It On":         "The 20/20 Experience – 2 of 2",
    "Amnesia":               "The 20/20 Experience – 2 of 2",
    "Cabaret":               "The 20/20 Experience – 2 of 2",
    "Murder":                "The 20/20 Experience – 2 of 2",
    "TKO":                   "The 20/20 Experience – 2 of 2",
    "Blindness":             "The 20/20 Experience – 2 of 2",
    "Electric Lady":         "The 20/20 Experience – 2 of 2",

    // ── MAN OF THE WOODS (2018) ─────────────────────────────────
    "Midnight Summer Jam":   "Man of the Woods",
    "Breeze Off the Pond":   "Man of the Woods",
    "Hers (interlude)":      "Man of the Woods",
    "Livin' Off the Land":   "Man of the Woods",
    "Higher Higher":         "Man of the Woods",
    "Morning Light":         "Man of the Woods",
    "Say Something":         "Man of the Woods",
    "The Hard Stuff":        "Man of the Woods",
    "Man of the Woods":      "Man of the Woods",
    "Young Man":             "Man of the Woods",
    "Supplies":              "Man of the Woods",
    "Montana":               "Man of the Woods",
    "Flannel":               "Man of the Woods",
    "Filthy":                "Man of the Woods",
    "Sauce":                 "Man of the Woods",
    "Wave":                  "Man of the Woods",

    // ── EVERYTHING I THOUGHT IT WAS (2024) ─────────────────────
    "F**kin' Up The Disco":  "Everything I Thought It Was",
    "What Lovers Do":        "Everything I Thought It Was",
    "My Favorite Drug":      "Everything I Thought It Was",
    "Infinity Sex":          "Everything I Thought It Was",
    "Technicolor":           "Everything I Thought It Was",
    "Love & War":            "Everything I Thought It Was",
    "Conditions":            "Everything I Thought It Was",
    "Sanctified":            "Everything I Thought It Was",
    "Imagination":           "Everything I Thought It Was",
    "No Angels":             "Everything I Thought It Was",
    "Paradise":              "Everything I Thought It Was",
    "Selfish":               "Everything I Thought It Was",
    "Memphis":               "Everything I Thought It Was",
    "Flame":                 "Everything I Thought It Was",
    "Alone":                 "Everything I Thought It Was",
    "Drown":                 "Everything I Thought It Was",
    "Liar":                  "Everything I Thought It Was",
    "Play":                  "Everything I Thought It Was",

    // ── ORPHAN / FEATURES ─────────────────────────────────────
    "CAN'T STOP THE FEELING!": "Orphan",
    "Holy Grail":              "Orphan",
    "Dead and Gone":           "Orphan",
    "4 Minutes":               "Orphan",
    "Give It To Me":           "Orphan",
    "Love Never Felt So Good": "Orphan",
    "Ayo Technology":          "Orphan",
    "Carry Out":               "Orphan",
    "The Other Side":          "Orphan",
    "Signs":                   "Orphan",
    "Stay With Me":            "Orphan",
    "Better Place":            "Orphan",
    "Where Is The Love":       "Orphan",
};
