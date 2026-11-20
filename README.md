# 周辺企業マップ (Nearby Companies Explorer)

ブラウザの現在地取得（Geolocation API）を利用して、現在地周辺の**企業・オフィス・上場企業本社・工場・専門事業所**を地図とリストで素早く検索できる Web アプリです。

🌐 **公開URL (GitHub Pages)**: https://pg-darksan.github.io/nearby-companies/

## 主な機能

- **📍 現在地からワンタップ検索**: ブラウザの位置情報（GPS / Wi-Fi）から周辺の企業を自動検索し、距離と徒歩分数目安を表示
- **🗾 任意のエリア・駅名・地図中心での検索**: 駅名・住所での場所移動や、地図を動かして「この地図の中心で再検索」が可能
- **🏢 マルチデータソース統合（APIキー不要）**:
  - **OpenStreetMap (Photon API)**: 地域の企業オフィス・IT企業・工場・建設・不動産・士業事務所・オフィスビルを網羅的に取得
  - **日本語版 Wikipedia GeoSearch & Wikidata**: 主要企業の本社・上場企業情報・**13桁の法人番号**・公式サイト・設立年を自動統合
- **🔍 業種フィルタ & キーワード絞り込み**:
  - 一般企業・本社 / IT・専門・研究 / 製造・工場・建設 / 金融・不動産・士業 / オフィスビル
  - 検索範囲切り替え（500m / 1km / 2km / 3km / 5km）
  - 並び替え（近い順 / 法人情報充実順 / 名前順）
- **📊 外部連携 & CSV出力**:
  - 公式サイト、Google マップ経路検索、gBizINFO（経済産業省 法人プロフィール）、採用・企業検索へのワンクリック遷移
  - お気に入り保存（ブラウザ `localStorage` 保存）
  - 表示中の企業リストを Excel 対応 UTF-8 BOM 付き CSV でダウンロード
- **📱 PC・スマートフォン対応 / ダークモード切替対応**

## 技術構成

- HTML5 / CSS3 / Vanilla JavaScript (ビルド不要・静的ホスティング完結)
- [Leaflet](https://leafletjs.com/) + OpenStreetMap タイル
- Photon Geocoding & Reverse POI API / MediaWiki Action API / Wikidata API
