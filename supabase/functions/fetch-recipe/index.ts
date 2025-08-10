import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { dishName, apiSource = 'spoonacular' } = await req.json()

    if (!dishName) {
      throw new Error('Dish name is required')
    }

    console.log(`Fetching recipe for: ${dishName} from ${apiSource}`)

    // Check cache first
    const cacheKey = dishName.toLowerCase().trim()
    const { data: cachedData } = await supabase
      .from('recipe_cache')
      .select('*')
      .eq('search_query', cacheKey)
      .eq('api_source', apiSource)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (cachedData) {
      console.log('Returning cached data')
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: cachedData.response_data,
          source: 'cache'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch from API based on source
    let apiData;
    
    if (apiSource === 'spoonacular') {
      apiData = await fetchFromSpoonacular(dishName)
    } else if (apiSource === 'edamam') {
      apiData = await fetchFromEdamam(dishName)
    } else if (apiSource === 'themealdb') {
      apiData = await fetchFromTheMealDB(dishName)
    } else {
      throw new Error('Invalid API source')
    }

    if (apiData) {
      // Store in cache (expires in 24 hours)
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)
      
      await supabase
        .from('recipe_cache')
        .upsert({
          search_query: cacheKey,
          api_source: apiSource,
          response_data: apiData,
          expires_at: expiresAt.toISOString()
        })

      // Store recipe in database
      await storeRecipe(supabase, apiData, apiSource)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: apiData,
        source: 'api'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function fetchFromSpoonacular(dishName: string) {
  const apiKey = Deno.env.get('SPOONACULAR_API_KEY')
  if (!apiKey) {
    throw new Error('Spoonacular API key not configured')
  }

  // Search for recipe
  const searchUrl = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${apiKey}&query=${encodeURIComponent(dishName)}&number=1&addRecipeInformation=true&fillIngredients=true`
  
  const searchResponse = await fetch(searchUrl)
  const searchData = await searchResponse.json()
  
  if (!searchData.results || searchData.results.length === 0) {
    throw new Error('No recipes found')
  }

  const recipe = searchData.results[0]
  
  // Get detailed recipe info
  const detailUrl = `https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${apiKey}&includeNutrition=true`
  const detailResponse = await fetch(detailUrl)
  const detailData = await detailResponse.json()

  return {
    id: detailData.id,
    title: detailData.title,
    image: detailData.image,
    readyInMinutes: detailData.readyInMinutes,
    servings: detailData.servings,
    ingredients: detailData.extendedIngredients?.map((ing: any) => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      originalString: ing.original
    })) || [],
    instructions: detailData.analyzedInstructions?.[0]?.steps?.map((step: any) => ({
      number: step.number,
      step: step.step
    })) || [],
    nutrition: detailData.nutrition || null
  }
}

async function fetchFromEdamam(dishName: string) {
  const appId = Deno.env.get('EDAMAM_APP_ID')
  const appKey = Deno.env.get('EDAMAM_APP_KEY')
  
  if (!appId || !appKey) {
    throw new Error('Edamam API credentials not configured')
  }

  const url = `https://api.edamam.com/search?q=${encodeURIComponent(dishName)}&app_id=${appId}&app_key=${appKey}&from=0&to=1`
  
  const response = await fetch(url)
  const data = await response.json()
  
  if (!data.hits || data.hits.length === 0) {
    throw new Error('No recipes found')
  }

  const recipe = data.hits[0].recipe
  
  return {
    id: recipe.uri.split('_')[1],
    title: recipe.label,
    image: recipe.image,
    readyInMinutes: null,
    servings: recipe.yield,
    ingredients: recipe.ingredients?.map((ing: any) => ({
      name: ing.food,
      amount: ing.quantity || 1,
      unit: ing.measure,
      originalString: ing.text
    })) || [],
    instructions: [], // Edamam doesn't provide instructions in free tier
    nutrition: recipe.totalNutrients || null
  }
}

async function fetchFromTheMealDB(dishName: string) {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dishName)}`
  
  const response = await fetch(url)
  const data = await response.json()
  
  if (!data.meals || data.meals.length === 0) {
    throw new Error('No recipes found')
  }

  const meal = data.meals[0]
  
  // Parse ingredients from TheMealDB format
  const ingredients = []
  for (let i = 1; i <= 20; i++) {
    const ingredient = meal[`strIngredient${i}`]
    const measure = meal[`strMeasure${i}`]
    
    if (ingredient && ingredient.trim()) {
      ingredients.push({
        name: ingredient.trim(),
        amount: measure ? measure.trim() : '',
        unit: '',
        originalString: `${measure || ''} ${ingredient}`.trim()
      })
    }
  }

  return {
    id: meal.idMeal,
    title: meal.strMeal,
    image: meal.strMealThumb,
    readyInMinutes: null,
    servings: null,
    ingredients,
    instructions: meal.strInstructions ? [{
      number: 1,
      step: meal.strInstructions
    }] : [],
    nutrition: null
  }
}

async function storeRecipe(supabase: any, recipeData: any, apiSource: string) {
  try {
    await supabase
      .from('recipes')
      .upsert({
        external_id: recipeData.id.toString(),
        api_source: apiSource,
        title: recipeData.title,
        image_url: recipeData.image,
        ready_in_minutes: recipeData.readyInMinutes,
        servings: recipeData.servings,
        ingredients: recipeData.ingredients,
        instructions: recipeData.instructions,
        nutrition: recipeData.nutrition
      })
  } catch (error) {
    console.error('Error storing recipe:', error)
    // Don't throw - storing is optional
  }
}