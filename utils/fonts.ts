/**
 * Font configuration
 * Place your Cinnamon Cake font file (CinnamonCake.ttf or CinnamonCake-Regular.ttf) 
 * in the assets/fonts/ directory
 */
export const FONT_FAMILY = 'CinnamonCake';

/**
 * Helper function to add font family to style objects
 */
export const withFont = (style: any) => {
  return {
    ...style,
    fontFamily: FONT_FAMILY,
  };
};
