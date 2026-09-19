-- portfolio_items に title 列が無い場合だけ追加する（既にあれば何も起きない安全なコマンド）
alter table portfolio_items add column if not exists title text;
