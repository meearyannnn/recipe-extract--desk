import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Heart, Trash2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FavoriteRecipe {
  id: string;
  recipe_id: string;
  recipes: {
    title: string;
    image_url?: string;
    ingredients: any;
    instructions?: any;
    servings?: number;
    ready_in_minutes?: number;
  };
}

export const UserFavorites = () => {
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select(`
          id,
          recipe_id,
          recipes (
            title,
            image_url,
            ingredients,
            instructions,
            servings,
            ready_in_minutes
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error: any) {
      console.error('Error fetching favorites:', error);
      toast({
        title: "Failed to load favorites",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeFavorite = async (favoriteId: string) => {
    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('id', favoriteId);

      if (error) throw error;

      setFavorites(favorites.filter(fav => fav.id !== favoriteId));
      
      toast({
        title: "Removed from favorites",
        description: "Recipe has been removed from your favorites",
      });
    } catch (error: any) {
      console.error('Error removing favorite:', error);
      toast({
        title: "Failed to remove favorite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Loading your favorites...</p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="text-center py-8">
        <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No favorites yet</h3>
        <p className="text-muted-foreground">Start adding recipes to your favorites!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Your Favorite Recipes</h2>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {favorites.map((favorite) => (
          <Card key={favorite.id} className="p-6 shadow-soft hover:shadow-elegant transition-smooth">
            {favorite.recipes.image_url && (
              <img 
                src={favorite.recipes.image_url} 
                alt={favorite.recipes.title}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            )}
            
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {favorite.recipes.title}
            </h3>
            
            <div className="flex gap-4 text-sm text-muted-foreground mb-4">
              {favorite.recipes.ready_in_minutes && (
                <span>{favorite.recipes.ready_in_minutes} min</span>
              )}
              {favorite.recipes.servings && (
                <span>{favorite.recipes.servings} servings</span>
              )}
              <span>{favorite.recipes.ingredients?.length || 0} ingredients</span>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => removeFavorite(favorite.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};