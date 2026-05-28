export interface VariantAttribute {
  name: string;
  values: string[];
}

export interface VariantCombination {
  [key: string]: string;
}

export interface SkuRow {
  id: string;
  combination: VariantCombination;
  price: string;
  stock: string;
  sku: string;
}

/**
 * Computes the Cartesian product of defined variation options.
 * Example:
 *   Input: [{ name: 'Color', values: ['Red', 'Blue'] }, { name: 'Size', values: ['S', 'M'] }]
 *   Output: [
 *     { Color: 'Red', Size: 'S' },
 *     { Color: 'Red', Size: 'M' },
 *     { Color: 'Blue', Size: 'S' },
 *     { Color: 'Blue', Size: 'M' }
 *   ]
 */
export function getCartesianProduct(attributes: VariantAttribute[]): VariantCombination[] {
  // Filter out attributes that are empty or have empty values
  const validAttributes = attributes.filter(
    (attr) => attr.name.trim() !== "" && attr.values.length > 0
  );

  if (validAttributes.length === 0) {
    return [];
  }

  const helper = (
    attrs: VariantAttribute[],
    index: number,
    current: VariantCombination,
    results: VariantCombination[]
  ) => {
    if (index === attrs.length) {
      results.push({ ...current });
      return;
    }

    const attr = attrs[index];
    const key = attr.name.trim();

    for (const val of attr.values) {
      const trimmedVal = val.trim();
      if (trimmedVal !== "") {
        current[key] = trimmedVal;
        helper(attrs, index + 1, current, results);
      }
    }
  };

  const results: VariantCombination[] = [];
  helper(validAttributes, 0, {}, results);
  return results;
}

/**
 * Generates an automated, clean, and normalized SKU string for a variation combination.
 * Format: PREFIX-VALUE1-VALUE2-VALUE3
 * Characters are normalized: spaces converted to hyphens, non-alphanumeric (except Thai characters) stripped, capitalized.
 */
export function generateSkuString(
  prefix: string,
  combination: VariantCombination,
  attributesOrder: string[]
): string {
  const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  
  const parts = attributesOrder
    .map((attrName) => combination[attrName])
    .filter(Boolean)
    .map((val) => {
      // Normalize values: keep Thai characters, English alphanumeric, hyphens, and underscores. Convert spaces to hyphens.
      return val
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "-")
        // Allow Thai characters (Unicode blocks Thai \u0E00-\u0E7F) and standard English/numbers
        .replace(/[^A-Z0-9\u0E00-\u0E7F_-]/g, "");
    });

  return [cleanPrefix, ...parts].filter(Boolean).join("-");
}
