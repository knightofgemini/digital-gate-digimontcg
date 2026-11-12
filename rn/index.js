// Ingresso dell'app: prima il controllo delle carte nuove in sottofondo (src/bgTask.ts, deve essere definito anche
// quando Android lo avvia ad app chiusa), poi l'app di sempre (Expo Router)
import "./src/bgTask";
import "expo-router/entry";
