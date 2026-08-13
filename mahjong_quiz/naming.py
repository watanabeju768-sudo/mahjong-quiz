"""mahjong ライブラリが返す英語表記を日本語に変換する対応表。

役名は `mahjong.hand_calculating.yaku_config.YakuConfig` が持つ `name` 属性、
符の理由は `mahjong.hand_calculating.fu.FuCalculator` の定数に対応する。
新しい役が増えた場合はここに追記するだけでよい。

日本語名にはそれぞれ読み（カタカナ）を持たせている。CUI では括弧書き、
ブラウザ版では ruby タグのふりがなとして表示される。
"""

from __future__ import annotations

# --- 役名（英語 -> 日本語） -------------------------------------------------
YAKU_JA = {
    # 1 翻役
    "Menzen Tsumo": "門前清自摸和",
    "Riichi": "立直",
    "Open Riichi": "オープン立直",
    "Ippatsu": "一発",
    "Chankan": "槍槓",
    "Rinshan Kaihou": "嶺上開花",
    "Haitei Raoyue": "海底摸月",
    "Houtei Raoyui": "河底撈魚",
    "Pinfu": "平和",
    "Tanyao": "断幺九",
    "Iipeiko": "一盃口",
    "Yakuhai (east)": "役牌 東",
    "Yakuhai (south)": "役牌 南",
    "Yakuhai (west)": "役牌 西",
    "Yakuhai (north)": "役牌 北",
    "Yakuhai (haku)": "役牌 白",
    "Yakuhai (hatsu)": "役牌 發",
    "Yakuhai (chun)": "役牌 中",
    "Yakuhai (wind of place)": "役牌 自風",
    "Yakuhai (wind of round)": "役牌 場風",
    # 2 翻役
    "Double Riichi": "ダブル立直",
    "Double Open Riichi": "ダブルオープン立直",
    "Sanshoku Doujun": "三色同順",
    "Ittsu": "一気通貫",
    "Chantai": "混全帯幺九",
    "Chiitoitsu": "七対子",
    "Toitoi": "対々和",
    "San Ankou": "三暗刻",
    "Sanshoku Doukou": "三色同刻",
    "San Kantsu": "三槓子",
    "Honroutou": "混老頭",
    "Shou Sangen": "小三元",
    # 3 翻役
    "Honitsu": "混一色",
    "Junchan": "純全帯幺九",
    "Ryanpeikou": "二盃口",
    # 6 翻役
    "Chinitsu": "清一色",
    # 満貫扱い
    "Nagashi Mangan": "流し満貫",
    # 役満
    "Kokushi Musou": "国士無双",
    "Kokushi Musou Juusanmen Matchi": "国士無双十三面待ち",
    "Chuuren Poutou": "九蓮宝燈",
    "Daburu Chuuren Poutou": "純正九蓮宝燈",
    "Suu Ankou": "四暗刻",
    "Suu Ankou Tanki": "四暗刻単騎",
    "Suu Kantsu": "四槓子",
    "Daisangen": "大三元",
    "Shousuushii": "小四喜",
    "Dai Suushii": "大四喜",
    "Tsuu Iisou": "字一色",
    "Chinroutou": "清老頭",
    "Ryuuiisou": "緑一色",
    "Tenhou": "天和",
    "Chiihou": "地和",
    "Renhou": "人和",
    "Renhou (yakuman)": "人和（役満）",
    "Daisharin": "大車輪",
    "Daichisei": "大七星",
    "Paarenchan": "八連荘",
    "Sashikomi": "指込み",
    # ドラ（役ではないが翻数に加算される）
    "Dora": "ドラ",
    "Aka Dora": "赤ドラ",
}

# 翻数に加算されるが「役」ではないもの。役一覧の表示からは除外する。
NON_YAKU_NAMES = {"Dora", "Aka Dora"}

# --- 役名の読み（日本語名 -> カタカナ） -------------------------------------
# 通称で読まれる役（混全帯幺九＝チャンタなど）は通称を採用している。
YAKU_READING = {
    "門前清自摸和": "メンゼンチンツモホー",
    "立直": "リーチ",
    "オープン立直": "オープンリーチ",
    "一発": "イッパツ",
    "槍槓": "チャンカン",
    "嶺上開花": "リンシャンカイホウ",
    "海底摸月": "ハイテイモーユエ",
    "河底撈魚": "ホウテイラオユイ",
    "平和": "ピンフ",
    "断幺九": "タンヤオチュー",
    "一盃口": "イーペーコー",
    "役牌 東": "ヤクハイ トン",
    "役牌 南": "ヤクハイ ナン",
    "役牌 西": "ヤクハイ シャー",
    "役牌 北": "ヤクハイ ペー",
    "役牌 白": "ヤクハイ ハク",
    "役牌 發": "ヤクハイ ハツ",
    "役牌 中": "ヤクハイ チュン",
    "役牌 自風": "ヤクハイ ジカゼ",
    "役牌 場風": "ヤクハイ バカゼ",
    "ダブル立直": "ダブルリーチ",
    "ダブルオープン立直": "ダブルオープンリーチ",
    "三色同順": "サンショクドウジュン",
    "一気通貫": "イッキツウカン",
    "混全帯幺九": "チャンタ",
    "七対子": "チートイツ",
    "対々和": "トイトイホー",
    "三暗刻": "サンアンコー",
    "三色同刻": "サンショクドウコー",
    "三槓子": "サンカンツ",
    "混老頭": "ホンロウトウ",
    "小三元": "ショウサンゲン",
    "混一色": "ホンイツ",
    "純全帯幺九": "ジュンチャン",
    "二盃口": "リャンペーコー",
    "清一色": "チンイツ",
    "流し満貫": "ナガシマンガン",
    "国士無双": "コクシムソウ",
    "国士無双十三面待ち": "コクシムソウ ジュウサンメンマチ",
    "九蓮宝燈": "チューレンポートー",
    "純正九蓮宝燈": "ジュンセイチューレンポートー",
    "四暗刻": "スーアンコー",
    "四暗刻単騎": "スーアンコー タンキ",
    "四槓子": "スーカンツ",
    "大三元": "ダイサンゲン",
    "小四喜": "ショウスーシー",
    "大四喜": "ダイスーシー",
    "字一色": "ツーイーソー",
    "清老頭": "チンロウトウ",
    "緑一色": "リューイーソー",
    "天和": "テンホー",
    "地和": "チーホー",
    "人和": "レンホー",
    "人和（役満）": "レンホー",
    "大車輪": "ダイシャリン",
    "大七星": "ダイチーセイ",
    "八連荘": "パーレンチャン",
    "指込み": "サシコミ",
    "ドラ": "",
    "赤ドラ": "アカドラ",
}

# --- 符の内訳（理由コード -> 日本語） ---------------------------------------
# 読み仮名を添えて表示するので、名前に説明の括弧書きは入れない。
FU_REASON_JA = {
    "base": "副底",
    "hand_without_fu": "平和形",
    "tsumo": "門前ツモ",
    "closed_pon": "中張牌の暗刻",
    "open_pon": "中張牌の明刻",
    "closed_terminal_pon": "么九牌の暗刻",
    "open_terminal_pon": "么九牌の明刻",
    "closed_kan": "中張牌の暗槓",
    "open_kan": "中張牌の明槓",
    "closed_terminal_kan": "么九牌の暗槓",
    "open_terminal_kan": "么九牌の明槓",
    "valued_pair": "役牌の雀頭",
    "double_valued_pair": "連風牌の雀頭",
    "penchan": "辺張待ち",
    "kanchan": "嵌張待ち",
    "pair_wait": "単騎待ち",
}

# --- 符の内訳の読み --------------------------------------------------------
FU_REASON_READING = {
    "副底": "フーテイ",
    "平和形": "ピンフガタ",
    "門前ツモ": "メンゼンツモ",
    "中張牌の暗刻": "チュンチャンハイのアンコ",
    "中張牌の明刻": "チュンチャンハイのミンコ",
    "么九牌の暗刻": "ヤオチューハイのアンコ",
    "么九牌の明刻": "ヤオチューハイのミンコ",
    "中張牌の暗槓": "チュンチャンハイのアンカン",
    "中張牌の明槓": "チュンチャンハイのミンカン",
    "么九牌の暗槓": "ヤオチューハイのアンカン",
    "么九牌の明槓": "ヤオチューハイのミンカン",
    "役牌の雀頭": "ヤクハイのジャントウ",
    "連風牌の雀頭": "レンフォンパイのジャントウ",
    "辺張待ち": "ペンチャンまち",
    "嵌張待ち": "カンチャンまち",
    "単騎待ち": "タンキまち",
}

# --- 満貫以上の呼び名 -------------------------------------------------------
YAKU_LEVEL_JA = {
    "mangan": "満貫",
    "haneman": "跳満",
    "baiman": "倍満",
    "sanbaiman": "三倍満",
    "yakuman": "役満",
    "kazoe yakuman": "数え役満",
    "nagashi mangan": "流し満貫",
    "2x yakuman": "ダブル役満",
    "3x yakuman": "トリプル役満",
    "4x yakuman": "4倍役満",
    "5x yakuman": "5倍役満",
    "6x yakuman": "6倍役満",
}


YAKU_LEVEL_READING = {
    "満貫": "マンガン",
    "跳満": "ハネマン",
    "倍満": "バイマン",
    "三倍満": "サンバイマン",
    "役満": "ヤクマン",
    "数え役満": "カゾエヤクマン",
    "流し満貫": "ナガシマンガン",
    "ダブル役満": "ダブルヤクマン",
    "トリプル役満": "トリプルヤクマン",
    "4倍役満": "ヨンバイヤクマン",
    "5倍役満": "ゴバイヤクマン",
    "6倍役満": "ロクバイヤクマン",
}


def yaku_name_ja(name: str) -> str:
    """役名を日本語にする。未知の役名はそのまま返す。"""
    return YAKU_JA.get(name, name)


def yaku_reading(name_ja: str) -> str:
    """日本語の役名から読み（カタカナ）を返す。未登録なら空文字。"""
    return YAKU_READING.get(name_ja, "")


def fu_reason_ja(reason: str) -> str:
    """符の理由を日本語にする。未知の理由はそのまま返す。"""
    return FU_REASON_JA.get(reason, reason)


def fu_reason_reading(reason_ja: str) -> str:
    """日本語の符の理由から読みを返す。未登録なら空文字。"""
    return FU_REASON_READING.get(reason_ja, "")


def yaku_level_ja(level: str) -> str:
    """満貫・跳満などのレベル名を日本語にする。空文字なら空文字。"""
    if not level:
        return ""
    return YAKU_LEVEL_JA.get(level, level)


def yaku_level_reading(level_ja: str) -> str:
    """満貫・跳満などの読みを返す。未登録なら空文字。"""
    return YAKU_LEVEL_READING.get(level_ja, "")
