/* Wetterstation-Statistiken 
   (c)2020 by SBorg 
   V0.0.1 - 06.09.2020   erste Alpha + Min/Max/Durchschnitt/Temp über 20/25°?/Windböe/Regen

   holt die Messdaten aus einer InfluxDB und erstellt eine Statistik

      ToDo: vieles ;)
            "Heiße Tage > 30°C" ; "Sommertage > 25°C" ; "Warme Tage > 20°C"
            "Kalte Tage (Max. unter 10°C)" ; "Frosttage (Min. unter 10°C)" ; "Eistage (Max. unter 0°C)" ; " Sehr kalte Tage (Min. unter -10°C)"
            "Maximum Windböe" ; "Regensumme Monat" ; " Maximum Regen/Tag"
   
   known issues: keine

*/

// *** User-Einstellungen ******************************************************************************
   let PRE_DP='javascript.0.Wetterstation'; /* wo liegen die Datenpunkte mit den Daten der Wetterstation
                                               [default: javascript.0.Wtterstation]                   */
// *** ENDE User-Einstellungen *************************************************************************

// Systemeinstellungen
let temps = [];
let wind = [];
let regen = [];
let zeitstempel = new Date();
let start = new Date(zeitstempel.getFullYear(),zeitstempel.getMonth()-1,zeitstempel.getDate(),0,0,0);
start = start.getTime();
let end = new Date(zeitstempel.getFullYear(),zeitstempel.getMonth(),zeitstempel.getDate(),23,59,59);
end = end.getTime();

//Abfrage der Influx-Datenbank
sendTo('influxdb.0', 'query', 
    'select * FROM "' + PRE_DP + '.Aussentemperatur" WHERE time >= ' + (start *1000000) + ' AND time <= ' + (end *1000000)
    + '; select * FROM "' + PRE_DP + '.Wind_max" WHERE time >= '  + (start *1000000) + ' AND time <= ' + (end *1000000)
    + '; select * FROM "' + PRE_DP + '.Regen_Tag" WHERE time >= ' + (start *1000000) + ' AND time <= ' + (end *1000000)
    , function (result) {

//Anlegen der Arrays + befüllen mit den relevanten Daten
    if (result.error) {
        console.error('Fehler: '+result.error);
    } else {
        //console.log('Rows: ' + JSON.stringify(result.result[2]));
        for (let i = 0; i < result.result[0].length; i++) { temps[i] = result.result[0][i].value; }
        for (let i = 0; i < result.result[1].length; i++) { wind[i] = result.result[1][i].value; }
        for (let i = 0; i < result.result[2].length; i++) { regen[i] = result.result[2][i].value; }
    }

 /*   const json = JSON.stringify(result.result[0][0]);
    const obj = JSON.parse(json);
    console.log(obj.ts);
    console.log(obj.value); */

//Debug-Consolenausgaben
    console.log('Daten ab ' + timeConverter(start));
    console.log('Daten bis ' + timeConverter(end)); 

    Math.sum = (...temps) => Array.prototype.reduce.call(temps,(a,b) => a+b);
    let Temp_Durchschnitt = (Math.sum(...temps)/temps.length).toFixed(2);
    Math.sum = (...regen) => Array.prototype.reduce.call(regen,(a,b) => a+b);
    if (Math.max(...temps) > 20) {console.log('Temperatur lag heute über 20 °C');}
    if (Math.max(...temps) > 25) {console.log('Temperatur lag heute über 25 °C');}
    console.log('Tiefstwert: ' + Math.min(...temps) + ' °C');
    console.log('Höchstwert: ' + Math.max(...temps) + ' °C');
    console.log('Durchschnitt: ' + Temp_Durchschnitt + ' °C');
    console.log('Maximum Windböe: ' + Math.max(...wind) + ' km/h');
    console.log('Regenmenge: ' + Math.sum(...regen).toFixed(2) + ' l/m²');
    console.log('Regenmenge/Tag: ' + Math.max(...regen) + ' l/m²');
    console.log('Erster Messwert: ' + new Date(result.result[0][0].ts).toISOString() + ' ***' + result.result[0][0].value);
    console.log('Letzter Messwert: ' + new Date(result.result[0][temps.length-1].ts).toISOString() + ' ***' + result.result[0][temps.length-1].value);
    console.log('Anzahl Datensätze: ' + temps.length);
});


// *** Funktionen ***
function timeConverter(UNIX_timestamp){
  let a = new Date(UNIX_timestamp);
  let months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  let year = a.getFullYear();
  let month = months[a.getMonth()];
  let date = a.getDate();
  let hour = a.getHours();
  let min = a.getMinutes();
  let sec = a.getSeconds();
  let time = pad(date) + '. ' + month + ' ' + year + ' ' + pad(hour) + ':' + pad(min) + ':' + pad(sec) ;
  return time;
}

function pad(n) {
    return n<10 ? '0'+n : n;
}

