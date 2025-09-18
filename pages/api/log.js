// REPLACE the whole route() with this:
function route(text) {
  const t = (text || "").toLowerCase();

  // ---------- HIGH-INTENT MATCHES FIRST (order matters) ----------

  // Wardrobe – Shopping List (do this before generic "ingredients/shopping list")
  if (
    (/\b(buy|order|need|wishlist|cart|add to list|pickup)\b/.test(t)) &&
    /\b(belt|socks|shoe|shoes|sneaker|loafer|boot|tie|blazer|jacket|shirt|t[-\s]?shirt|tee|polo|jeans|pant|trouser|chino|dress|skirt|hat|cap|scarf|glove|hoodie|sweater|cardigan|coat)\b/.test(t)
  ) {
    return { sectionKey: "Lifestyle and Wardrobe – Shopping List", kind: "wardrobe_shop" };
  }

  // Finance – Options Trading
  if (/\b(options?|calls?|puts?|spreads?|iron condor|covered call|theta|delta|gamma)\b/.test(t)) {
    return { sectionKey: "Finance and Career – Options Trading", kind: "options" };
  }

  // Finance – Planning
  if (/\b(401k|roth|ira|retire|retirement|plan|planning|allocation|savings goal|rebalance)\b/.test(t)) {
    return { sectionKey: "Finance and Career - Planning", kind: "finance_planning" };
  }

  // Finance (general bills/expenses/income)
  if (/\b(pay(check)?|paid|bill|billed|invoice|expense|spend|spent|budget|salary|bonus|tax|subscription|refund|charge|charged)\b/.test(t)) {
    return { sectionKey: "Finance and Career", kind: "finance" };
  }

  // ---------- FITNESS ----------
  // steps
  if (/\b(\d{3,6})\s*steps?\b/.test(t) || /^steps?:?\s*\d+/.test(t)) {
    return { sectionKey: "Fitness - Step Counts", kind: "steps" };
  }

  // workout / gym
  if (/(workout|gym|lift|ran|run|yoga|peloton|cycling|swim|upper body|lower body|cardio)/.test(t)) {
    return { sectionKey: "Fitness - Workouts", kind: "workout" };
  }

  // ---------- FOOD ----------
  // alcohol
  if (/\b(whisky|whiskey|wine|beer|scotch|bourbon|tasting|gin|vodka|tequila|mezcal|rum|sake)\b/.test(t)) {
    return { sectionKey: "Food and Nutrition - Alcohol Notes", kind: "alcohol" };
  }

  // ingredients / groceries (keep AFTER wardrobe shopping)
  if (/\b(ingredients?|grocer(y|ies)|shopping\s*list|add to list|need to buy|grocery|market)\b/.test(t)) {
    return { sectionKey: "Food and Nutrition - Ingredients", kind: "ingredients" };
  }

  // meals
  if (/^(meal|ate|breakfast|lunch|dinner|snack)\b/.test(t) || /\b(ate|cooked|ordered)\b/.test(t)) {
    return { sectionKey: "Food and Nutrition", kind: "meal" };
  }

  // ---------- JOURNAL / TRAVEL / WARDROBE OUTFITS ----------
  if (/^(journal|diary|reflection|thought|today|note:)\b/.test(t) || /\breflection\b/.test(t)) {
    return { sectionKey: "Journal", kind: "journal" };
  }

  if (/\b(flight|hotel|airbnb|booked|trip|visa|itinerary|airport|boarding pass|lounge)\b/.test(t)) {
    return { sectionKey: "Travel", kind: "travel" };
  }

  // Wardrobe – Closet & Outfits
  if (/\b(outfit|ootd|shirt|pants|jeans|jacket|dress|sneakers?|shoes|closet|wardrobe|look)\b/.test(t)) {
    return { sectionKey: "Lifestyle and Wardrobe – Closet and Outfits", kind: "wardrobe_outfit" };
  }

  // ---------- FALLBACK ----------
  return { sectionKey: "Inbox", kind: "inbox" };
}
