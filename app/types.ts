export interface ProfileData {
  id: string;
  theme_color: string; // 例: '#1F2937' や '#059669'
  ai_usage: 'none' | 'partial' | 'full';
  available_from_text: string;
  skills: string[];
  accepting_orders: boolean;
  form_config: {
    fields: Array<{ id: string; label: string; type: string }>;
    options?: Record<string, any>;
  } | null;
}