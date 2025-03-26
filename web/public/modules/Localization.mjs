

export class Localization {

    coords = null;

    constructor(){
        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition(
              (position) => {
                this.coords = position.coords;
                const { latitude, longitude, altitude } = position.coords;
                console.log("Pos:", latitude, longitude, altitude);
                // Atualize seu jogo/VR com a nova localização...

              },
              (error) => {
                console.error("Erro ao obter localização:", error);
              },
              {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000,
              }
            );
          } else {
            console.log("Geolocalização não é suportada pelo seu navegador.");
          }
    }

    getGeoPosition(){
        return this.coords;
    }
}