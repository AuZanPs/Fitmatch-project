import { createClient } from '@supabase/supabase-js';
import { DEFAULT_CATEGORIES, DEFAULT_STYLE_TAGS } from '../../shared/constants';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = () => {
  const isConfigured = !!(supabaseUrl && 
         supabaseAnonKey && 
         supabaseUrl !== 'https://your-project.supabase.co' && 
         supabaseAnonKey !== 'your-anon-key' &&
         supabaseAnonKey !== 'your-anon-key-here');
  
  // Debug log for troubleshooting
  if (!isConfigured) {
    console.log('Supabase configuration check failed:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlValue: supabaseUrl || 'undefined',
      keyLength: supabaseAnonKey?.length || 0
    });
  }
  
  return isConfigured;
};

export const supabase = isSupabaseConfigured() 
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export interface ClothingItem {
  id: string;
  user_id: string;
  image_url: string;
  category_id: number;
  brand?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  category?: Category;
  style_tags?: StyleTag[];
}

export interface Category {
  id: number;
  name: string;
  created_at: string;
}

export interface StyleTag {
  id: number;
  name: string;
  created_at: string;
}

export interface ClothingItemWithTags extends ClothingItem {
  clothing_item_style_tags: {
    style_tag: StyleTag;
  }[];
}

// Helper function to check if Supabase is available
const checkSupabaseAvailable = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment variables.');
  }
  return supabase;
};

// Authentication helpers with proper error handling
export const signUp = async (email: string, password: string) => {
  const client = checkSupabaseAvailable();
  return await client.auth.signUp({ email, password });
};

export const signIn = async (email: string, password: string) => {
  const client = checkSupabaseAvailable();
  return await client.auth.signInWithPassword({ email, password });
};

export const signInWithGoogle = async () => {
  const client = checkSupabaseAvailable();
  return await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`
    }
  });
};

export const signOut = async () => {
  const client = checkSupabaseAvailable();
  return await client.auth.signOut();
};

export const getCurrentSession = async () => {
  const client = checkSupabaseAvailable();
  return await client.auth.getSession();
};

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  const client = checkSupabaseAvailable();
  return client.auth.onAuthStateChange(callback);
};

// Database functions with error handling
export const getCategories = async () => {
  const client = checkSupabaseAvailable();

  try {
    const { data, error } = await client
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) {
      return DEFAULT_CATEGORIES;
    }
    
    return data.length > 0 ? data : DEFAULT_CATEGORIES;
  } catch (error) {
    return DEFAULT_CATEGORIES;
  }
};

export const getStyleTags = async () => {
  const client = checkSupabaseAvailable();

  try {
    const { data, error } = await client
      .from('style_tags')
      .select('*')
      .order('name');
    
    if (error) {
      return DEFAULT_STYLE_TAGS;
    }
    
    return data.length > 0 ? data : DEFAULT_STYLE_TAGS;
  } catch (error) {
    return DEFAULT_STYLE_TAGS;
  }
};

export const getUserClothingItems = async (userId: string) => {
  const client = checkSupabaseAvailable();
  const { data, error } = await client
    .from('clothing_items')
    .select(`
      *,
      category:categories(*),
      clothing_item_style_tags(
        style_tag:style_tags(*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const getClothingItemsByStyle = async (userId: string, styleTagId: number) => {
  const client = checkSupabaseAvailable();
  const { data, error } = await client
    .from('clothing_items')
    .select(`
      *,
      category:categories(*),
      clothing_item_style_tags!inner(
        style_tag:style_tags(*)
      )
    `)
    .eq('user_id', userId)
    .eq('clothing_item_style_tags.style_tag_id', styleTagId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const uploadClothingImage = async (file: File, userId: string) => {
  const client = checkSupabaseAvailable();
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  
  const { data, error } = await client.storage
    .from('clothing-images')
    .upload(fileName, file);
  
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = client.storage
    .from('clothing-images')
    .getPublicUrl(fileName);
  
  return urlData.publicUrl;
};

export const createClothingItem = async (
  userId: string,
  imageUrl: string,
  categoryId: number,
  styleTagIds: number[],
  brand?: string,
  color?: string
) => {
  const client = checkSupabaseAvailable();
  
  // Insert clothing item
  const { data: clothingItem, error: itemError } = await client
    .from('clothing_items')
    .insert({
      user_id: userId,
      image_url: imageUrl,
      category_id: categoryId,
      brand,
      color
    })
    .select()
    .single();
  
  if (itemError) throw itemError;
  
  // Insert style tag associations
  if (styleTagIds.length > 0) {
    const styleTagInserts = styleTagIds.map(styleTagId => ({
      clothing_item_id: clothingItem.id,
      style_tag_id: styleTagId
    }));
    
    const { error: tagsError } = await client
      .from('clothing_item_style_tags')
      .insert(styleTagInserts);
    
    if (tagsError) throw tagsError;
  }
  
  return clothingItem;
};

export const deleteClothingItem = async (itemId: string) => {
  const client = checkSupabaseAvailable();
  const { error } = await client
    .from('clothing_items')
    .delete()
    .eq('id', itemId);
  
  if (error) throw error;
};
