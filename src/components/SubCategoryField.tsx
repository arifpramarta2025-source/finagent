import React from 'react';
import { useCategories } from '../hooks/useCategories';
import { visibleSubCategories } from '../utils/categories';
import { withCurrentOption } from '../utils/constants';

interface SubCategoryFieldProps {
  category: string;
  value: string;
  onChange: (value: string) => void;
  labelClassName: string;
  inputClassName: string;
}

export const SubCategoryField: React.FC<SubCategoryFieldProps> = ({
  category,
  value,
  onChange,
  labelClassName,
  inputClassName,
}) => {
  const subCategories = visibleSubCategories(useCategories(), category);

  return (
    <div>
      <label className={labelClassName}>Subkategori</label>
      {subCategories.length > 0 ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClassName}>
          <option value="">Pilih subkategori</option>
          {withCurrentOption(subCategories, value).map((subCategory) => (
            <option key={subCategory} value={subCategory}>
              {subCategory}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tulis subkategori jika perlu"
          className={inputClassName}
        />
      )}
    </div>
  );
};
