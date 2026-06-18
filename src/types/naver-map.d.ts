declare global {
  interface Window {
    naver?: {
      maps: {
        Event: typeof naver.maps.Event;
        LatLng: typeof naver.maps.LatLng;
        Map: typeof naver.maps.Map;
        Marker: typeof naver.maps.Marker;
        Panorama: typeof naver.maps.Panorama;
        Point: typeof naver.maps.Point;
        Polyline: typeof naver.maps.Polyline;
        Position: typeof naver.maps.Position;
        Size: typeof naver.maps.Size;
        StreetLayer: typeof naver.maps.StreetLayer;
        TransCoord: typeof naver.maps.TransCoord;
      };
    };
  }
}

export {};
