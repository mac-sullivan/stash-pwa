export interface ParsedCard {
  name: string;
  company: string;
  phone: string;
  additionalPhone: string;
  email: string;
  website: string;
  additionalWebsite: string;
  address: string;
  socialMedia: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };
  notes: string;
  categories: string[];
}

export interface StashCard {
  id: number;
  created_at: string;
  user_id: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  additional_phone: string | null;
  email: string | null;
  website: string | null;
  additional_website: string | null;
  address: string | null;
  social_media: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  } | null;
  notes: string | null;
  card_image_url: string | null;
  card_images: string[] | null;
  categories: string[] | null;
}

export interface MyCard {
  id: string;
  user_id: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  additional_phone: string | null;
  email: string | null;
  website: string | null;
  additional_website: string | null;
  address: string | null;
  social_media: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  } | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
