<!--
現行DB（public）のテーブル構成の記録。supabase/export_current_schema.sql の③で書き出したもの。
列・型・null可否・デフォルトのみで、主キー・外部キー・RLS・インデックスは含まない。
DBを変更したら、この記録も更新すること。
-->

## admins
- user_id: uuid not null
- created_at: timestamp with time zone not null default now()

## analytics_logs
- id: uuid not null default gen_random_uuid()
- created_at: timestamp with time zone default now()
- creator_id: uuid
- event_type: text not null
- metadata: jsonb default '{}'::jsonb

## creator_forms
- id: uuid not null default gen_random_uuid()
- user_id: uuid
- title: text default 'ご依頼・見積もりフォーム'::text
- description: text
- theme_color: text default '#ec4899'::text
- is_accepting: boolean default true
- thanks_message: text
- fields: jsonb default '[]'::jsonb
- updated_at: timestamp with time zone default now()

## custom_page_settings
- user_id: uuid not null
- theme_color: character varying default '#6366f1'::character varying
- font_family: character varying default 'sans-serif'::character varying
- background_type: character varying default 'color'::character varying
- background_url: text
- custom_cursor_url: text
- custom_css: text

## estimate_forms
- id: uuid not null default gen_random_uuid()
- user_id: uuid not null
- title: text not null default 'ご依頼・お仕事申請フォーム'::text
- description: text not null default ''::text
- theme_color: text not null default '#ec4899'::text
- is_accepting: boolean not null default true
- fields: jsonb not null default '[]'::jsonb
- sort_order: integer not null default 0
- created_at: timestamp with time zone not null default now()
- updated_at: timestamp with time zone not null default now()

## favorite_creators
- user_id: uuid not null
- creator_id: uuid not null
- created_at: timestamp with time zone not null default now()

## favorites
- id: uuid not null default gen_random_uuid()
- user_id: uuid not null
- creator_id: text not null
- created_at: timestamp with time zone not null default timezone('utc'::text, now())

## icon_rings
- id: text not null
- name: text not null
- cost: integer not null
- image_url: text not null
- sort_order: integer not null default 0
- created_at: timestamp with time zone not null default now()
- available_from: timestamp with time zone
- available_until: timestamp with time zone

## notifications
- id: uuid not null default gen_random_uuid()
- user_id: uuid not null
- type: text not null
- title: text not null
- body: text
- link_url: text
- is_read: boolean not null default false
- created_at: timestamp with time zone not null default now()

## page_blocks
- id: uuid not null default gen_random_uuid()
- user_id: uuid
- block_type: character varying not null
- sort_order: text not null
- content_data: jsonb not null default '{}'::jsonb
- style_data: jsonb default '{}'::jsonb

## point_transactions
- id: uuid not null default gen_random_uuid()
- user_id: uuid not null
- amount: integer not null
- reason: text not null
- created_at: timestamp with time zone not null default now()

## portfolio_items
- id: uuid not null default gen_random_uuid()
- user_id: uuid
- title: character varying
- image_url: text not null
- before_image_url: text
- is_pinned: boolean default false
- sort_order: text default 0
- created_at: timestamp with time zone default now()

## post_comments
- id: uuid not null default gen_random_uuid()
- post_id: uuid not null
- user_id: uuid not null
- content: text not null
- created_at: timestamp with time zone default now()

## post_likes
- post_id: uuid not null
- user_id: uuid not null
- created_at: timestamp with time zone default now()

## posts
- id: uuid not null default gen_random_uuid()
- user_id: uuid not null
- content: character varying not null
- image_urls: ARRAY default '{}'::text[]
- is_sensitive: boolean default false
- created_at: timestamp with time zone default now()

## profiles
- user_id: uuid not null
- display_name: text not null default ''::text
- status: text default 'available'::text
- status_comment: text
- tastes: ARRAY default '{}'::text[]
- lead_time_days: integer
- price_min: integer
- commercial_use_allowed: boolean default true
- avatar_url: text
- external_estimation_url: text
- twitter_url: text
- instagram_url: text
- pixiv_url: text
- website_url: text
- updated_at: timestamp with time zone default now()
- is_public: boolean not null default true
- likes_count: integer default 0
- menu_items: jsonb default '[]'::jsonb
- ai_usage: text default 'none'::text
- ai_learning_allowed: boolean default false
- express_option_available: boolean default false
- copyright_transfer_available: boolean default false
- free_revision_count: integer default 2
- r18_allowed: boolean default false
- form_config: jsonb
- active_projects_count: integer default 1
- max_projects_capacity: integer default 3
- available_from_text: text default '10月上旬〜'::text
- available_from: date
- sns_links: jsonb
- theme_color: text default 'indigo'::text
- campaign_enabled: boolean not null default false
- campaign_label: text
- campaign_discount_type: text
- campaign_discount_value: numeric
- campaign_start_at: timestamp with time zone
- campaign_end_at: timestamp with time zone
- accepts_direct_requests: boolean not null default true
- has_dashboard_setup: boolean not null default false

## referrals
- id: uuid not null default gen_random_uuid()
- referrer_id: uuid not null
- referred_id: uuid not null
- bonus_awarded: integer not null default 0
- created_at: timestamp with time zone not null default now()

## reports
- id: uuid not null default gen_random_uuid()
- reporter_id: uuid
- target_type: text not null
- target_id: text not null
- creator_id: uuid not null
- reason: text not null
- comment: text
- status: text not null default 'open'::text
- created_at: timestamp with time zone not null default now()

## requests
- id: uuid not null default gen_random_uuid()
- creator_id: uuid not null
- client_id: uuid not null
- content: text not null
- budget: numeric
- status: text not null default 'pending'::text
- creator_response: text
- created_at: timestamp with time zone not null default now()
- updated_at: timestamp with time zone not null default now()
- client_contact_url: text
- image_urls: ARRAY not null default '{}'::text[]
- usage_type: text
- reference_url: text
- size_spec: text
- desired_deadline: date

## reviews
- id: uuid not null default gen_random_uuid()
- creator_id: uuid not null
- reviewer_id: uuid not null
- rating: integer not null
- comment: text
- created_at: timestamp with time zone not null default now()
- updated_at: timestamp with time zone not null default now()
- image_urls: ARRAY not null default '{}'::text[]

## user_icon_rings
- user_id: uuid not null
- ring_id: text not null
- purchased_at: timestamp with time zone not null default now()

## user_points
- user_id: uuid not null
- balance: integer not null default 0
- equipped_ring_id: text
- created_at: timestamp with time zone not null default now()
- updated_at: timestamp with time zone not null default now()
