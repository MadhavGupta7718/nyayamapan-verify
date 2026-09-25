/**
 * States, union territories and their districts. Compiled from general knowledge, not fetched
 * from the Local Government Directory (lgdirectory.gov.in): review against LGD before relying on
 * it. District boundaries change often; the Super Admin geography screen can add, rename or
 * deactivate entries without a code change. District Hindi names are left to that screen.
 */
export type GeoState = { code: string; name: string; nameHi: string; districts: string[] };

export const INDIA_GEOGRAPHY: GeoState[] = [
  {
    code: "AP",
    name: "Andhra Pradesh",
    nameHi: "आंध्र प्रदेश",
    districts: [
      "Alluri Sitharama Raju", "Anakapalli", "Anantapur", "Annamayya", "Bapatla", "Chittoor", "Dr. B.R. Ambedkar Konaseema",
      "East Godavari", "Eluru", "Guntur", "Kakinada", "Krishna", "Kurnool", "Nandyal", "NTR", "Palnadu", "Parvathipuram Manyam",
      "Prakasam", "Sri Potti Sriramulu Nellore", "Sri Sathya Sai", "Srikakulam", "Tirupati", "Visakhapatnam", "Vizianagaram",
      "West Godavari", "YSR Kadapa",
    ],
  },
  {
    code: "AR",
    name: "Arunachal Pradesh",
    nameHi: "अरुणाचल प्रदेश",
    districts: [
      "Anjaw", "Bichom", "Changlang", "Dibang Valley", "East Kameng", "East Siang", "Kamle", "Keyi Panyor", "Kra Daadi", "Kurung Kumey",
      "Lepa Rada", "Lohit", "Longding", "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai", "Pakke-Kessang",
      "Papum Pare", "Shi Yomi", "Siang", "Tawang", "Tirap", "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang",
    ],
  },
  {
    code: "AS",
    name: "Assam",
    nameHi: "असम",
    districts: [
      "Bajali", "Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri",
      "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan",
      "Karbi Anglong", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur",
      "South Salmara-Mankachar", "Sribhumi", "Tamulpur", "Tinsukia", "Udalguri", "West Karbi Anglong",
    ],
  },
  {
    code: "BR",
    name: "Bihar",
    nameHi: "बिहार",
    districts: [
      "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya",
      "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani",
      "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura",
      "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran",
    ],
  },
  {
    code: "CG",
    name: "Chhattisgarh",
    nameHi: "छत्तीसगढ़",
    districts: [
      "Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband",
      "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham", "Kanker", "Khairagarh-Chhuikhadan-Gandai", "Kondagaon",
      "Korba", "Koriya", "Mahasamund", "Manendragarh-Chirmiri-Bharatpur", "Mohla-Manpur-Ambagarh Chowki", "Mungeli", "Narayanpur",
      "Raigarh", "Raipur", "Rajnandgaon", "Sakti", "Sarangarh-Bilaigarh", "Sukma", "Surajpur", "Surguja",
    ],
  },
  { code: "GA", name: "Goa", nameHi: "गोवा", districts: ["North Goa", "South Goa"] },
  {
    code: "GJ",
    name: "Gujarat",
    nameHi: "गुजरात",
    districts: [
      "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod", "Dang",
      "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi",
      "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara",
      "Valsad", "Vav-Tharad",
    ],
  },
  {
    code: "HR",
    name: "Haryana",
    nameHi: "हरियाणा",
    districts: [
      "Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal",
      "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar",
    ],
  },
  {
    code: "HP",
    name: "Himachal Pradesh",
    nameHi: "हिमाचल प्रदेश",
    districts: ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"],
  },
  {
    code: "JH",
    name: "Jharkhand",
    nameHi: "झारखंड",
    districts: [
      "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara",
      "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahebganj", "Seraikela Kharsawan", "Simdega",
      "West Singhbhum",
    ],
  },
  {
    code: "KA",
    name: "Karnataka",
    nameHi: "कर्नाटक",
    districts: [
      "Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru South", "Bengaluru Urban", "Bidar", "Chamarajanagar",
      "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri",
      "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada",
      "Vijayanagara", "Vijayapura", "Yadgir",
    ],
  },
  {
    code: "KL",
    name: "Kerala",
    nameHi: "केरल",
    districts: [
      "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad",
      "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad",
    ],
  },
  {
    code: "MP",
    name: "Madhya Pradesh",
    nameHi: "मध्य प्रदेश",
    districts: [
      "Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat", "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur",
      "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori", "Guna", "Gwalior", "Harda", "Indore", "Jabalpur", "Jhabua", "Katni",
      "Khandwa", "Khargone", "Maihar", "Mandla", "Mandsaur", "Mauganj", "Morena", "Narmadapuram", "Narsinghpur", "Neemuch", "Niwari",
      "Pandhurna", "Panna", "Raisen", "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur",
      "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain", "Umaria", "Vidisha",
    ],
  },
  {
    code: "MH",
    name: "Maharashtra",
    nameHi: "महाराष्ट्र",
    districts: [
      "Ahilyanagar", "Akola", "Amravati", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Chhatrapati Sambhajinagar", "Dharashiv", "Dhule",
      "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded",
      "Nandurbar", "Nashik", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane",
      "Wardha", "Washim", "Yavatmal",
    ],
  },
  {
    code: "MN",
    name: "Manipur",
    nameHi: "मणिपुर",
    districts: [
      "Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney",
      "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul",
    ],
  },
  {
    code: "ML",
    name: "Meghalaya",
    nameHi: "मेघालय",
    districts: [
      "East Garo Hills", "East Jaintia Hills", "East Khasi Hills", "Eastern West Khasi Hills", "North Garo Hills", "Ri Bhoi",
      "South Garo Hills", "South West Garo Hills", "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills",
    ],
  },
  {
    code: "MZ",
    name: "Mizoram",
    nameHi: "मिज़ोरम",
    districts: ["Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib", "Lawngtlai", "Lunglei", "Mamit", "Saitual", "Serchhip", "Siaha"],
  },
  {
    code: "NL",
    name: "Nagaland",
    nameHi: "नागालैंड",
    districts: [
      "Chümoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng", "Meluri", "Mokokchung", "Mon", "Niuland", "Noklak", "Peren", "Phek",
      "Shamator", "Tseminyü", "Tuensang", "Wokha", "Zünheboto",
    ],
  },
  {
    code: "OD",
    name: "Odisha",
    nameHi: "ओडिशा",
    districts: [
      "Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak", "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati", "Ganjam",
      "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput", "Malkangiri",
      "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada", "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh",
    ],
  },
  {
    code: "PB",
    name: "Punjab",
    nameHi: "पंजाब",
    districts: [
      "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar",
      "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar", "Sangrur",
      "Shaheed Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran",
    ],
  },
  {
    code: "RJ",
    name: "Rajasthan",
    nameHi: "राजस्थान",
    districts: [
      "Ajmer", "Alwar", "Balotra", "Banswara", "Baran", "Barmer", "Beawar", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh",
      "Churu", "Dausa", "Deeg", "Dholpur", "Didwana-Kuchaman", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar",
      "Jhunjhunu", "Jodhpur", "Karauli", "Khairthal-Tijara", "Kota", "Kotputli-Behror", "Nagaur", "Pali", "Phalodi", "Pratapgarh",
      "Rajsamand", "Salumbar", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur",
    ],
  },
  { code: "SK", name: "Sikkim", nameHi: "सिक्किम", districts: ["Gangtok", "Gyalshing", "Mangan", "Namchi", "Pakyong", "Soreng"] },
  {
    code: "TN",
    name: "Tamil Nadu",
    nameHi: "तमिल नाडु",
    districts: [
      "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram",
      "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur",
      "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli",
      "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar",
    ],
  },
  {
    code: "TS",
    name: "Telangana",
    nameHi: "तेलंगाना",
    districts: [
      "Adilabad", "Bhadradri Kothagudem", "Hanumakonda", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal",
      "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak",
      "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla",
      "Ranga Reddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri",
    ],
  },
  {
    code: "TR",
    name: "Tripura",
    nameHi: "त्रिपुरा",
    districts: ["Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala", "South Tripura", "Unakoti", "West Tripura"],
  },
  {
    code: "UP",
    name: "Uttar Pradesh",
    nameHi: "उत्तर प्रदेश",
    districts: [
      "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia",
      "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot",
      "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda",
      "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar",
      "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau",
      "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Rae Bareli", "Rampur", "Saharanpur",
      "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur",
      "Unnao", "Varanasi",
    ],
  },
  {
    code: "UK",
    name: "Uttarakhand",
    nameHi: "उत्तराखंड",
    districts: [
      "Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag",
      "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi",
    ],
  },
  {
    code: "WB",
    name: "West Bengal",
    nameHi: "पश्चिम बंगाल",
    districts: [
      "Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram",
      "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur",
      "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur",
    ],
  },
  { code: "AN", name: "Andaman and Nicobar Islands", nameHi: "अंडमान और निकोबार द्वीपसमूह", districts: ["Nicobar", "North and Middle Andaman", "South Andaman"] },
  { code: "CH", name: "Chandigarh", nameHi: "चंडीगढ़", districts: ["Chandigarh"] },
  {
    code: "DH",
    name: "Dadra and Nagar Haveli and Daman and Diu",
    nameHi: "दादरा और नगर हवेली और दमन और दीव",
    districts: ["Dadra and Nagar Haveli", "Daman", "Diu"],
  },
  {
    code: "DL",
    name: "Delhi",
    nameHi: "दिल्ली",
    districts: [
      "Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi",
      "South East Delhi", "South West Delhi", "West Delhi",
    ],
  },
  {
    code: "JK",
    name: "Jammu and Kashmir",
    nameHi: "जम्मू और कश्मीर",
    districts: [
      "Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda", "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara", "Poonch",
      "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur",
    ],
  },
  { code: "LA", name: "Ladakh", nameHi: "लद्दाख", districts: ["Kargil", "Leh"] },
  { code: "LD", name: "Lakshadweep", nameHi: "लक्षद्वीप", districts: ["Lakshadweep"] },
  { code: "PY", name: "Puducherry", nameHi: "पुडुचेरी", districts: ["Karaikal", "Mahe", "Puducherry", "Yanam"] },
];
