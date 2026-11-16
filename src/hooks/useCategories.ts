import { createContext, useContext } from 'react';
import { CategoryConfig, buildDefaultCategories } from '../utils/categories';

const CategoryContext = createContext<CategoryConfig>(buildDefaultCategories());

export const CategoryProvider = CategoryContext.Provider;

export function useCategories(): CategoryConfig {
  return useContext(CategoryContext);
}
