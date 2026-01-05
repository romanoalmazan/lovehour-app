export type RootStackParamList = {
  Home: undefined;
  Auth: undefined;
  LoveHour: { openGallery?: 'your' | 'partner' } | undefined;
  Schedule: undefined;
  UserProfileSetup: undefined;
  ChoosePartner: undefined;
  Profile: undefined;
  TermsOfService: undefined;
  MainTabs: undefined;
};

export type BottomTabParamList = {
  LoveHour: { openGallery?: 'your' | 'partner' } | undefined;
  Schedule: undefined;
};
