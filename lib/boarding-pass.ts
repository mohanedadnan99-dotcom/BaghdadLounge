export type BoardingPassData={
  passengerName:string; pnr:string; origin:string; destination:string; carrier:string; flightNumber:string;
  julianDate:string; compartment:string; seat:string; checkInSequence:string; passengerStatus:string;
};

const clean=(v:string)=>v.replace(/\s+/g," ").trim();
export function parseIataBcbp(rawInput:string):BoardingPassData|null{
  const raw=rawInput.replace(/[\r\n\t]/g,"").trimEnd();
  if(raw.length<58||raw[0]!=="M")return null;
  const legs=Number(raw[1]);
  if(!Number.isInteger(legs)||legs<1)return null;
  const passengerName=clean(raw.slice(2,22)).replace("/"," ");
  const pnr=clean(raw.slice(23,30));
  const origin=clean(raw.slice(30,33));
  const destination=clean(raw.slice(33,36));
  const carrier=clean(raw.slice(36,39));
  const flightNumber=clean(raw.slice(39,44)).replace(/^0+/,"")||"0";
  const julianDate=clean(raw.slice(44,47));
  const compartment=clean(raw.slice(47,48));
  const seat=clean(raw.slice(48,52)).replace(/^0+/,"");
  const checkInSequence=clean(raw.slice(52,57)).replace(/^0+/,"")||"0";
  const passengerStatus=clean(raw.slice(57,58));
  if(!passengerName&&!origin&&!destination&&!carrier&&!flightNumber)return null;
  return {passengerName,pnr,origin,destination,carrier,flightNumber,julianDate,compartment,seat,checkInSequence,passengerStatus};
}
