import pandas as pd

def remove_duplicate_food_names(input_file='nutrition_data.csv', output_file='deduplicated_nutrition.csv'):
    """
    Remove rows with duplicate food names, keeping the first occurrence.
    
    Args:
        input_file: Path to input CSV file
        output_file: Path to save deduplicated CSV file
    """
    # Load the CSV file
    df = pd.read_csv(input_file)
    
    print(f"Original data: {len(df)} rows")
    print(f"Unique food names: {df['Food Name'].nunique()}")
    
    # Remove duplicates based on 'Food Name' column
    # keep='first' keeps the first occurrence, removes subsequent duplicates
    df_deduplicated = df.drop_duplicates(subset=['Food Name'], keep='first')
    
    print(f"\nAfter removing duplicates: {len(df_deduplicated)} rows")
    print(f"Removed {len(df) - len(df_deduplicated)} duplicate rows")
    
    # Save to new CSV file
    df_deduplicated.to_csv(output_file, index=False)
    print(f"\nSaved deduplicated data to: {output_file}")
    
    # Show some statistics
    print("\nTop 10 most duplicated foods (before deduplication):")
    duplicates = df['Food Name'].value_counts()
    top_duplicates = duplicates[duplicates > 1].head(10)
    for food_name, count in top_duplicates.items():
        print(f"  {food_name[:60]}...: {count} occurrences")
    
    return df_deduplicated

def remove_duplicates_and_summarize(input_file='nutrition_data.csv', output_file='deduplicated_with_summary.csv'):
    """
    Remove duplicates and create a summary of what was removed.
    """
    # Load the data
    df = pd.read_csv(input_file)
    
    print(f"Processing {input_file}...")
    print(f"Total rows: {len(df)}")
    
    # Identify duplicates
    duplicate_mask = df.duplicated(subset=['Food Name'], keep='first')
    duplicates = df[duplicate_mask]
    unique_df = df[~duplicate_mask]
    
    print(f"\nFound {len(duplicates)} duplicate rows to remove")
    print(f"Keeping {len(unique_df)} unique rows")
    
    # Create a summary of removed duplicates
    summary = []
    for food_name in duplicates['Food Name'].unique():
        food_duplicates = duplicates[duplicates['Food Name'] == food_name]
        kept_row = unique_df[unique_df['Food Name'] == food_name]
        
        if len(kept_row) > 0:
            summary.append({
                'Food Name': food_name,
                'Removed Count': len(food_duplicates),
                'Kept Profile #': kept_row.iloc[0]['Profile #'] if 'Profile #' in kept_row.columns else 'N/A',
                'Kept Occurrences': kept_row.iloc[0]['Occurrences'] if 'Occurrences' in kept_row.columns else 'N/A'
            })
    
    # Create summary DataFrame
    summary_df = pd.DataFrame(summary)
    
    # Save the deduplicated data
    unique_df.to_csv(output_file, index=False)
    
    # Save summary to separate file
    summary_file = 'removed_duplicates_summary.csv'
    summary_df.to_csv(summary_file, index=False)
    
    print(f"\nSaved deduplicated data to: {output_file}")
    print(f"Saved removal summary to: {summary_file}")
    
    # Show what was kept vs removed
    print("\nSample of what was kept (first 5 unique items):")
    for i, (_, row) in enumerate(unique_df.head(5).iterrows(), 1):
        print(f"  {i}. {row['Food Name'][:60]}...")
    
    print("\nSample of what was removed (first 5 duplicates):")
    for i, (_, row) in enumerate(duplicates.head(5).iterrows(), 1):
        print(f"  {i}. {row['Food Name'][:60]}... (Profile #{row.get('Profile #', 'N/A')})")
    
    return unique_df, summary_df

def simple_deduplicate(input_file='nutrition_data.csv'):
    """
    Simple one-line deduplication.
    """
    df = pd.read_csv(input_file)
    df_unique = df.drop_duplicates(subset=['Food Name'])
    
    output_file = 'simple_deduplicated.csv'
    df_unique.to_csv(output_file, index=False)
    
    print(f"Simple deduplication complete!")
    print(f"Before: {len(df)} rows")
    print(f"After: {len(df_unique)} rows")
    print(f"Removed: {len(df) - len(df_unique)} duplicates")
    print(f"Saved to: {output_file}")
    
    return df_unique

# Run the script
if __name__ == "__main__":
    import sys
    
    # Get input file from command line or use default
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        input_file = 'unique_foods_nutrition.csv'
    
    print("="*60)
    print("FOOD DATA DEDUPLICATION TOOL")
    print("="*60)
    
    try:
        # Option 1: Simple deduplication (keeps first occurrence)
        print("\n1. Running simple deduplication...")
        dedup_df = remove_duplicate_food_names(input_file, 'deduplicated_nutrition.csv')
        
        print("\n" + "="*60)
        
        # Option 2: With detailed summary
        print("\n2. Running detailed deduplication with summary...")
        unique_df, summary_df = remove_duplicates_and_summarize(input_file, 'deduplicated_detailed.csv')
        
        print("\n" + "="*60)
        print("DEDUPLICATION COMPLETE!")
        print("="*60)
        
    except FileNotFoundError:
        print(f"\nError: File '{input_file}' not found!")
        print("Please specify a valid CSV file path.")
        print("Usage: python deduplicate.py [input_file.csv]")
    except Exception as e:
        print(f"\nError: {e}")