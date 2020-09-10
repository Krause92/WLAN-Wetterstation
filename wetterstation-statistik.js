/* Wetterstation-Statistiken 
   (c)2020 by SBorg 
   V0.0.1 - 10.09.2020   erste Beta + Min/Max/Durchschnitt

   holt die Messdaten aus einer InfluxDB und erstellt eine Monats- und Vorjahres-Statistik
   Wichtig: funktioniert nur mit der Datenstruktur des WLAN-Wetterstation-Skriptes!

      ToDo: vieles ;)
            "Heiße Tage > 30°C" ; "Sommertage > 25°C" ; "Warme Tage > 20°C"
            "Kalte Tage (Max. unter 10°C)" ; "Frosttage (Min. unter 10°C)" ; "Eistage (Max. unter 0°C)" ; " Sehr kalte Tage (Min. unter -10°C)"
            "Maximum Windböe" ; "Regensumme Monat" ; "Maximum Regen/Tag"
            Tages-/Jahresstatistik?
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
if (!existsState(PRE_DP+'.Vorjahres_Monat.Temperatur_Durchschnitt')) { createDP(); }


//Start des Scripts
    let Tiefstwert, Hoechstwert, Temp_Durchschnitt;
    let monatstage = [31,28,31,30,31,30,31,31,30,31,30,31];
    let temps = [], wind = [], regen = [];
    console.log('Wetterstation-Statistiken gestartet...');
//main(); // XXX - nur für Debug; später löschen
    
//scheduler
    schedule(ZEITPLAN, main);



// ### Funktionen ###############################################################################################
function main() {
    let start, end;
    let zeitstempel = new Date();
    start = new Date(zeitstempel.getFullYear(),zeitstempel.getMonth(),zeitstempel.getDate()-1,0,0,0);
    start = start.getTime();
    end = new Date(zeitstempel.getFullYear(),zeitstempel.getMonth(),zeitstempel.getDate()-1,23,59,59);
    end = end.getTime();

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
 if (zeitstempel.getDate() == 1) { // Jobs Monatserster
   /*DPs unabhängig ihres Wertes initial schreiben; wir nehmen die aktuelle Aussentemp, da sie zum Start des Nesszyklus
     Min, Max und Durchschnitt darstellt */
     let initialTemp=getState(WET_DP+'.Aussentemperatur').val;
   setState(PRE_DP+'.aktueller_Monat.Tiefstwert', initialTemp, true);
   setState(PRE_DP+'.aktueller_Monat.Hoechstwert', initialTemp, true);
   setState(PRE_DP+'.aktueller_Monat.Temperatur_Durchschnitt', initialTemp, true);
   speichern_Monat();  //vorherige Monatsstatistik speichern
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
    createState(PRE_DP+monatsdatenpunkt,'',{ name: "Monatsstatistik für "+monat[datum.getMonth()-1]+' '+datum.getFullYear(), type: "string", role: "json" }, () => { setState(PRE_DP+monatsdatenpunkt, json, true); }); 
} //end function

function VorJahr() {  
    let VTiefstwert, VHoechstwert, VTemp_Durchschnitt; 
    let zeitstempel = new Date();
    let datum = new Date(zeitstempel.getFullYear(),zeitstempel.getMonth(),zeitstempel.getDate());
    let monatsdatenpunkt = '.Data.'+ (datum.getFullYear()-1) +'.'+pad(datum.getMonth()+1);
    if (existsState(PRE_DP+monatsdatenpunkt)) {
        //der einfache Weg: wir haben schon Daten vom Vorjahr...
        let VorJahr = getState(PRE_DP+monatsdatenpunkt).val;
        VorJahr = JSON.parse(VorJahr);
        setState(PRE_DP+'.Vorjahres_Monat.Tiefstwert', VorJahr.Tiefstwert, true);
        setState(PRE_DP+'.Vorjahres_Monat.Hoechstwert', VorJahr.Hoechstwert, true);
        setState(PRE_DP+'.Vorjahres_Monat.Temperatur_Durchschnitt', VorJahr.Temp_Durchschnitt, true); 
    } else {
        //leider noch keine Daten vom Vorjahr; wir haben was zu tun...
        //Abfrage der Influx-Datenbank
        let start, end;
        start = new Date(zeitstempel.getFullYear()-1,zeitstempel.getMonth(),1,0,0,0);
        start = start.getTime();
        end = new Date(zeitstempel.getFullYear()-1,zeitstempel.getMonth(),monatstage[zeitstempel.getMonth()],23,59,59);
        end = end.getTime();
            sendTo('influxdb.'+INFLUXDB_INSTANZ, 'query', 
             'select * FROM "' + WET_DP + '.Aussentemperatur" WHERE time >= ' + (start *1000000) + ' AND time <= ' + (end *1000000)
             + '; select * FROM "' + WET_DP + '.Wind_max" WHERE time >= '  + (start *1000000) + ' AND time <= ' + (end *1000000)
             + '; select * FROM "' + WET_DP + '.Regen_Tag" WHERE time >= ' + (start *1000000) + ' AND time <= ' + (end *1000000)
                , function (result) {
                //Anlegen der Arrays + befüllen mit den relevanten Daten
                if (result.error) {
                  console.error('Fehler: '+result.error);
                } else {
                 //falls keinerlei Daten vom Vorjahr vorhanden sind...
                   if (typeof result.result[0][0] === "undefined") {
                    temps.length=0;
                    temps[0]=99999; 
                   } else {               
                    for (let i = 0; i < result.result[0].length; i++) { temps[i] = result.result[0][i].value; }
                    for (let i = 0; i < result.result[1].length; i++) { wind[i] = result.result[1][i].value; }
                    for (let i = 0; i < result.result[2].length; i++) { regen[i] = result.result[2][i].value; }
                   }
                }           
      
                //Temperaturen
                VTiefstwert = Math.min(...temps);
                VHoechstwert = Math.max(...temps);
                Math.sum = (...temps) => Array.prototype.reduce.call(temps,(a,b) => a+b);
                VTemp_Durchschnitt = Number((Math.sum(...temps)/temps.length).toFixed(2));
                //DPs schreiben
                setState(PRE_DP+'.Vorjahres_Monat.Tiefstwert', VTiefstwert, true);
                setState(PRE_DP+'.Vorjahres_Monat.Hoechstwert', VHoechstwert, true);
                setState(PRE_DP+'.Vorjahres_Monat.Temperatur_Durchschnitt', VTemp_Durchschnitt, true);
            }); //end sendTo
        
    } //end else  

} //end function


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

    createState(PRE_DP+'.Vorjahres_Monat.Tiefstwert',             99999, { name: "Tiefstwert",              type: "number", role: "state", unit: "°C" });
    createState(PRE_DP+'.Vorjahres_Monat.Hoechstwert',            99999, { name: "Höchstwert",              type: "number", role: "state", unit: "°C" });
    createState(PRE_DP+'.Vorjahres_Monat.Temperatur_Durchschnitt',99999, { name: "Durchschnittstemperatur", type: "number", role: "state", unit: "°C" });
    
    await Sleep(1500);
}
