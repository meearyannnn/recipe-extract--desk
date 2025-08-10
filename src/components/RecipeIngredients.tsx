import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Download, Loader2, Utensils, Clock, Users, Heart, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';

interface Ingredient {
  name: string;
  amount: string | number;
  unit: string;
  originalString?: string;
}

interface Recipe {
  id: string;
  title: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
  ingredients: Ingredient[];
  instructions?: { number: number; step: string }[];
  nutrition?: any;
}

export const RecipeIngredients = () => {
  const [dishName, setDishName] = useState('');
  const [apiSource, setApiSource] = useState('spoonacular');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getIngredients = async () => {
    if (!dishName.trim()) {
      toast({
        title: "Please enter a dish name",
        description: "Enter the name of the dish to get its ingredients",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-recipe', {
        body: { 
          dishName: dishName.trim(),
          apiSource 
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch recipe');
      }

      setRecipe(data.data);
      
      toast({
        title: "Recipe found!",
        description: `Found ingredients for ${dishName} from ${apiSource === 'themealdb' ? 'TheMealDB' : apiSource}`,
      });
    } catch (error: any) {
      console.error('Error fetching recipe:', error);
      toast({
        title: "Failed to fetch recipe",
        description: error.message || "Please try again or use a different API source",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!recipe || !recipe.ingredients.length) {
      toast({
        title: "No ingredients to download",
        description: "Please search for a dish first",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(24);
    doc.setTextColor(231, 76, 60); // Coral color
    doc.text(`Recipe: ${recipe.title}`, 20, 30);
    
    // Subtitle
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 40);
    
    // Recipe info
    if (recipe.servings || recipe.readyInMinutes) {
      let infoText = '';
      if (recipe.servings) infoText += `Servings: ${recipe.servings}`;
      if (recipe.readyInMinutes) {
        if (infoText) infoText += ' | ';
        infoText += `Ready in: ${recipe.readyInMinutes} min`;
      }
      doc.text(infoText, 20, 50);
    }

    let yPosition = 70;
    
    // Ingredients header
    doc.setFontSize(16);
    doc.setTextColor(46, 125, 50); // Green color
    doc.text('Ingredients:', 20, yPosition);
    yPosition += 15;
    
    // Ingredients list
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    
    recipe.ingredients.forEach((ingredient) => {
      const ingredientText = ingredient.originalString || 
        `• ${ingredient.amount} ${ingredient.unit} ${ingredient.name}`;
      
      // Handle text wrapping for long ingredient names
      const splitText = doc.splitTextToSize(ingredientText, 170);
      doc.text(splitText, 25, yPosition);
      yPosition += (splitText.length * 6) + 2;
      
      // Add new page if running out of space
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
    });

    // Instructions if available
    if (recipe.instructions && recipe.instructions.length > 0) {
      yPosition += 10;
      
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(16);
      doc.setTextColor(46, 125, 50);
      doc.text('Instructions:', 20, yPosition);
      yPosition += 15;
      
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      
      recipe.instructions.forEach((instruction) => {
        const instructionText = `${instruction.number}. ${instruction.step}`;
        const splitText = doc.splitTextToSize(instructionText, 170);
        doc.text(splitText, 25, yPosition);
        yPosition += (splitText.length * 6) + 4;
        
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Recipe Ingredients App', 20, 280);
    
    doc.save(`${recipe.title.replace(/\s+/g, '-').toLowerCase()}-recipe.pdf`);
    
    toast({
      title: "PDF Downloaded!",
      description: `Recipe for ${recipe.title} has been downloaded`,
    });
  };

  const categorizeIngredients = (ingredients: Ingredient[]) => {
    // Simple categorization based on common ingredient types
    const categories: Record<string, Ingredient[]> = {};
    
    ingredients.forEach(ingredient => {
      let category = 'Other';
      const name = ingredient.name.toLowerCase();
      
      if (name.includes('chicken') || name.includes('beef') || name.includes('pork') || 
          name.includes('fish') || name.includes('egg') || name.includes('bacon')) {
        category = 'Protein';
      } else if (name.includes('onion') || name.includes('tomato') || name.includes('pepper') ||
                 name.includes('carrot') || name.includes('lettuce') || name.includes('garlic')) {
        category = 'Vegetables';
      } else if (name.includes('milk') || name.includes('cheese') || name.includes('butter') ||
                 name.includes('cream') || name.includes('yogurt')) {
        category = 'Dairy';
      } else if (name.includes('flour') || name.includes('sugar') || name.includes('baking')) {
        category = 'Baking';
      } else if (name.includes('salt') || name.includes('pepper') || name.includes('spice') ||
                 name.includes('herb') || name.includes('curry') || name.includes('paprika')) {
        category = 'Seasonings & Spices';
      }
      
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(ingredient);
    });
    
    return categories;
  };

  const groupedIngredients = recipe ? categorizeIngredients(recipe.ingredients) : {};

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <ChefHat className="h-12 w-12 text-primary" />
            <h1 className="text-5xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              Recipe Ingredients
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get real recipe ingredients from top cooking APIs and download as PDF
          </p>
        </div>

        {/* Search Form */}
        <Card className="p-8 mb-8 shadow-elegant animate-slide-up">
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label htmlFor="dish" className="block text-sm font-medium mb-2 text-foreground">
                  What dish would you like to cook?
                </label>
                <Input
                  id="dish"
                  type="text"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  placeholder="e.g., Chicken Curry, Spaghetti Carbonara, Chocolate Chip Cookies..."
                  className="text-lg py-3 transition-smooth focus:shadow-soft"
                  onKeyPress={(e) => e.key === 'Enter' && getIngredients()}
                />
              </div>
              <div className="min-w-[180px]">
                <label htmlFor="api-source" className="block text-sm font-medium mb-2 text-foreground">
                  Recipe Source
                </label>
                <Select value={apiSource} onValueChange={setApiSource}>
                  <SelectTrigger className="py-3">
                    <SelectValue placeholder="Select API" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spoonacular">Spoonacular (Premium)</SelectItem>
                    <SelectItem value="edamam">Edamam (Nutrition Focus)</SelectItem>
                    <SelectItem value="themealdb">TheMealDB (Free)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={getIngredients}
                disabled={isLoading}
                variant="hero"
                size="lg"
                className="px-8"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finding...
                  </>
                ) : (
                  <>
                    <Utensils className="h-4 w-4" />
                    Get Recipe
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Recipe Results */}
        {recipe && (
          <div className="animate-bounce-in">
            {/* Recipe Header */}
            <div className="flex flex-col md:flex-row gap-6 mb-8">
              {recipe.image && (
                <div className="md:w-1/3">
                  <img 
                    src={recipe.image} 
                    alt={recipe.title}
                    className="w-full h-64 object-cover rounded-lg shadow-soft"
                  />
                </div>
              )}
              <div className="flex-1">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-3xl font-bold text-foreground">
                    {recipe.title}
                  </h2>
                  <Button
                    onClick={downloadPDF}
                    variant="accent"
                    size="lg"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
                
                <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                  {recipe.readyInMinutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {recipe.readyInMinutes} minutes
                    </div>
                  )}
                  {recipe.servings && (
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {recipe.servings} servings
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ingredients */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(groupedIngredients).map(([category, categoryIngredients]) => (
                <Card key={category} className="p-6 shadow-soft hover:shadow-elegant transition-smooth">
                  <h3 className="text-lg font-semibold text-accent mb-4 border-b border-border pb-2">
                    {category}
                  </h3>
                  <ul className="space-y-3">
                    {categoryIngredients.map((ingredient, index) => (
                      <li key={index} className="text-sm">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-foreground flex-1">
                            {ingredient.name}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            {ingredient.amount} {ingredient.unit}
                          </span>
                        </div>
                        {ingredient.originalString && ingredient.originalString !== `${ingredient.amount} ${ingredient.unit} ${ingredient.name}` && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {ingredient.originalString}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>

            {/* Instructions */}
            {recipe.instructions && recipe.instructions.length > 0 && (
              <Card className="p-6 mt-8 shadow-soft">
                <h3 className="text-2xl font-semibold text-foreground mb-6">Instructions</h3>
                <div className="space-y-4">
                  {recipe.instructions.map((instruction) => (
                    <div key={instruction.number} className="flex gap-4">
                      <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {instruction.number}
                      </div>
                      <p className="text-foreground leading-relaxed pt-1">
                        {instruction.step}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* API Setup Notice */}
        <div className="mt-12 text-center animate-fade-in">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-2 text-amber-800 dark:text-amber-200">
              API Setup Required
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
              To fetch real recipe data, you'll need to configure API keys for the recipe services.
              Click the button below to set them up securely.
            </p>
            <Button 
              onClick={() => window.open('https://supabase.com/dashboard/project/pqlzwswqxolaezhqbswf/settings/functions', '_blank')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Configure API Keys
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};