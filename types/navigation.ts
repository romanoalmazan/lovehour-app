export type RootStackParamList = {
  Home: undefined;
  Auth: undefined;
  LoveHour: { openGallery?: 'your' | 'partner' } | undefined;
  Notepad: undefined;
  UserProfileSetup: undefined;
  ChoosePartner: undefined;
  Profile: undefined;
  TermsOfService: undefined;
  MainTabs: undefined;
};

export type BottomTabParamList = {
  LoveHour: { openGallery?: 'your' | 'partner' } | undefined;
  Notepad: undefined;
};
