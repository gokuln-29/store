/**
 * Texts for app/global-error.tsx, which replaces the root layout when that layout itself fails,
 * so no translation provider is available. Kept tiny because this boundary ships with every page.
 */
export const GLOBAL_ERROR_MESSAGES = {
  en: {
    title: "Something went wrong",
    description: "The page couldn't load. Please try again in a moment.",
    retry: "Try again",
  },
  ta: {
    title: "ஏதோ தவறு நடந்துவிட்டது",
    description: "பக்கத்தை ஏற்ற முடியவில்லை. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.",
    retry: "மீண்டும் முயற்சிக்கவும்",
  },
  kn: {
    title: "ಏನೋ ತಪ್ಪಾಗಿದೆ",
    description: "ಪುಟವನ್ನು ತೆರೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    retry: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
  },
} as const;
