declare global {
  interface Window {
    naver?: {
      maps: typeof naver.maps;
    };
  }
}

export {};
