/* Wetterstation-Statistiken 
   (c)2020 by SBorg 
   V0.0.1 - 08.09.2020   erste Alpha + Min/Max/Durchschnitt/Temp über 20/25°?/Windböe/Regen

   holt die Messdaten aus einer InfluxDB und erstellt eine Statistik

      ToDo: vieles ;)
            "Heiße Tage > 30°C" ; "Sommertage > 25°C" ; "Warme Tage > 20°C"
            "Kalte Tage (Max. unter 10°C)" ; "Frosttage (Min. unter 10°C)" ; "Eistage (Max. unter 0°C)" ; " Sehr kalte Tage (Min. unter -10°C)"
            "Maximum Windböe" ; "Regensumme Monat" ; " Maximum Regen/Tag"
            Monatswerte resetten
   known issues: keine

*/



// *** User-Einstellungen ***************************************************************************************
    let WET_DP='javascript.0.Wetterstation';    /* wo liegen die Datenpunkte mit den Daten der Wetterstation
                                                   [default: javascript.0.Wetterstation]                   */
    let INFLUXDB_INSTANZ='0';                   // unter welcher Instanz läuft die InfluxDB [default: 0]   
    let PRE_DP='0_userdata.0.Statistik.Wetter'; // wo sollen die Statistikwerte abgelegt werden   
    const ZEITPLAN = "3 1 * * *";               // wann soll die Statistik erstellt werden (Minuten Stunde * * *)                       
// *** ENDE User-Einstellungen **********************************************************************************




//ab hier gibt es nix mehr zu ändern :)
//firstStart?
if (!isState(PRE_DP+'.aktueller_Monat.Temperatur_Durchschnitt', false)) { createDP(); }


//Start des Scripts
main(); // XXX - nur für Debug; später löschen
    let Tiefstwert, Hoechstwert, Temp_Durchschnitt;
    console.log('Wetterstation-Statistiken gestartet...');
//scheduler
    schedule(ZEITPLAN, main);



// ### Funktionen ###############################################################################################
function main() {

// Systemeinstellungen
    let temps = [], wind = [], regen = [];
    let zeitstempel = new Date();
    let start = new Date(zeitstempel.getFullYear(),zeitstempel.getMonth(),zeitstempel.getDate()-1,0,0,0);
    start = start.getTime();
    let end = new Date(zeitstempel.getFullYear(),zeitstempel.getMonth(),zeitstempel.getDate()-1,23,59,59);
    end = end.getTime();

//Abfrage der Influx-Datenbank
sendTo('influxdb.'+INFLUXDB_INSTANZ, 'query', 
    'select * FROM "' + WET_DP + '.Aussentemperatur" WHERE time >= ' + (start *1000000) + ' AND time <= ' + (end *1000000)
    + '; select * FROM "' + WET_DP + '.Wind_max" WHERE time >= '  + (start *1000000) + ' AND time <= ' + (end *1000000)
    + '; select * FROM "' + WET_DP + '.Regen_Tag" WHERE time >= ' + (start *1000000) + ' AND time <= ' + (end *1000000)
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

 
//Berechnungen
  //Temperaturen
    Tiefstwert = Math.min(...temps);
    Hoechstwert = Math.max(...temps);
    Math.sum = (...temps) => Array.prototype.reduce.call(temps,(a,b) => a+b);
    Temp_Durchschnitt = Number((Math.sum(...temps)/temps.length).toFixed(2));

    
//Debug-Consolenausgaben
    console.log('Daten ab ' + timeConverter(start));
    console.log('Daten bis ' + timeConverter(end)); 


    if (Math.max(...temps) > 20) {console.log('Temperatur lag heute über 20 °C');}
    if (Math.max(...temps) > 25) {console.log('Temperatur lag heute über 25 °C');}
    console.log('Maximum Windböe: ' + Math.max(...wind) + ' km/h');
    console.log('Regenmenge/Tag: ' + Math.max(...regen) + ' l/m²');
    console.log('Erster Messwert: ' + new Date(result.result[0][0].ts).toISOString() + ' ***' + result.result[0][0].value);
    console.log('Letzter Messwert: ' + new Date(result.result[0][temps.length-1].ts).toISOString() + ' ***' + result.result[0][temps.length-1].value);
    console.log('Anzahl Datensätze: T_' + temps.length + '|W_' + wind.length + '|R_' + regen.length);

//Datenpunkte schreiben
 if (zeitstempel.getDate() == 8) { // Jobs Monatserster (tatsächlich erst am 2. da wir immer mit einem Tag Verzögerung arbeiten)
   //DPs unabhängig ihres Wertes initial schreiben
   setState(PRE_DP+'.aktueller_Monat.Tiefstwert', Tiefstwert, true);
   setState(PRE_DP+'.aktueller_Monat.Hoechstwert', Hoechstwert, true);
   setState(PRE_DP+'.aktueller_Monat.Temperatur_Durchschnitt', Temp_Durchschnitt, true);
   speichern_Monat();  //aktuelle Monatsstatistik speichern
   VorJahr();          //Vorjahresmonatsstatistik ausführen
  } else {
   if (getState(PRE_DP+'.aktueller_Monat.Tiefstwert').val > Tiefstwert) {setState(PRE_DP+'.aktueller_Monat.Tiefstwert', Tiefstwert, true);}    
   if (getState(PRE_DP+'.aktueller_Monat.Hoechstwert').val < Hoechstwert) {setState(PRE_DP+'.aktueller_Monat.Hoechstwert', Hoechstwert, true);}    
   if (getState(PRE_DP+'.aktueller_Monat.Temperatur_Durchschnitt').val != Temp_Durchschnitt) {setState(PRE_DP+'.aktueller_Monat.Temperatur_Durchschnitt', Temp_Durchschnitt, true);}
  }

 });
} //end function

function speichern_Monat() {
    let monat = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    let zeitstempel = new Date();
    let datum = new Date(zeitstempel.getFullYear(),zeitstempel.getMonth(),zeitstempel.getDate()-2);
    let monatsdatenpunkt = '.Data.'+datum.getFullYear()+'.'+pad(datum.getMonth()); 
    let json = JSON.stringify({Tiefstwert: Tiefstwert, Hoechstwert: Hoechstwert, Temp_Durchschnitt: new Number(Temp_Durchschnitt)});
    createState(PRE_DP+monatsdatenpunkt,'',  { name: "Monatsstatistik für "+monat[datum.getMonth()-1]+' '+datum.getFullYear(), type: "string", role: "json" }, () => { setState(PRE_DP+monatsdatenpunkt, json, true); });
    
} //end function


function VorJahr() {}

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

// Pause einlegen
function Sleep(milliseconds) {
 return new Promise(resolve => setTimeout(resolve, milliseconds));
}

//Datenpunkte anlegen
async function createDP() {
    console.log(PRE_DP + ' existiert nicht... Lege Datenstruktur an...');
    createState(PRE_DP, '', { name: 'Wetterstatistik' });
    createState(PRE_DP+'.aktueller_Monat',                        '',   { name: 'Statistik für den aktuellen Monat' });
    createState(PRE_DP+'.Vorjahres_Monat',                        '',   { name: 'Statistik für den Monat des Vorjahres' });
    createState(PRE_DP+'.Data',                                   '',   { name: 'bisherige Statistiken' });
    createState(PRE_DP+'.aktueller_Monat.Tiefstwert',             100,  { name: "Tiefstwert",              type: "number", role: "state", unit: "°C" });
    createState(PRE_DP+'.aktueller_Monat.Hoechstwert',            -100, { name: "Höchstwert",              type: "number", role: "state", unit: "°C" });
    createState(PRE_DP+'.aktueller_Monat.Temperatur_Durchschnitt',0,    { name: "Durchschnittstemperatur", type: "number", role: "state", unit: "°C" });
    await Sleep(200);
}


/*
  Checks if a a given state or part of state is existing.
  This is a workaround, as getObject() or getState() throw warnings in the log.
  Set strict to true if the state shall match exactly. If it is false, it will add a wildcard * to the end.
  See: https://forum.iobroker.net/topic/11354/
  @param {string}    strStatePath     Input string of state, like 'javas-cript.0.switches.Osram.Bedroom'
  @param {boolean}   [strict=false]   Optional: if true, it will work strict, if false, it will add a wildcard * to the end of the string
  @return {boolean}                   true if state exists, false if not
 */
function isState(strStatePath, strict) {
    let mSelector;
    if (strict) { mSelector = $('state[id=' + strStatePath + '$]'); } else { mSelector = $('state[id=' + strStatePath + ']'); }
    if (mSelector.length > 0) { return true; } else { return false; }
}

