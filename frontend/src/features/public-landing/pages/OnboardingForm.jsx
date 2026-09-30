import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  GraduationCap, 
  ArrowRight, 
  Loader2, 
  MailCheck, 
  Mail, 
  Send, 
  AlertCircle,
  FileText,
  Sparkles,
  Tag
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Philippine Administrative Divisions Mapping
const PHILIPPINE_LOCATIONS = {
  'NCR - National Capital Region': {
    provinces: {
      'Metro Manila': [
        'Caloocan City', 'Las Piñas City', 'Makati City', 'Malabon City',
        'Mandaluyong City', 'Manila', 'Marikina City', 'Muntinlupa City',
        'Navotas City', 'Parañaque City', 'Pasay City', 'Pasig City',
        'Pateros', 'Quezon City', 'San Juan City', 'Taguig City', 'Valenzuela City'
      ]
    }
  },
  'CAR - Cordillera Administrative Region': {
    provinces: {
      'Abra': ['Bangued', 'Boliney', 'Bucay', 'Bucloc', 'Daguioman', 'Danglas', 'Dolores', 'La Paz', 'Lacub', 'Lagangilang', 'Lagayan', 'Langiden', 'Licuan-Baay', 'Luba', 'Malibcong', 'Manabo', 'Peñarrubia', 'Pidigan', 'Pilar', 'Sallapadan', 'San Isidro', 'San Juan', 'San Quintin', 'Tayum', 'Tineg', 'Tubo', 'Villaviciosa'],
      'Apayao': ['Calanasan', 'Conner', 'Flora', 'Kabugao', 'Luna', 'Pudtol', 'Santa Marcela'],
      'Benguet': ['Atok', 'Baguio City', 'Bakun', 'Bokod', 'Buguias', 'Itogon', 'Kabayan', 'Kapangan', 'Kibungan', 'La Trinidad', 'Mankayan', 'Sablan', 'Tuba', 'Tublay'],
      'Ifugao': ['Banaue', 'Hungduan', 'Kiangan', 'Lagawe', 'Lamut', 'Mayoyao', 'Alfonso Lista', 'Aguinaldo', 'Asipulo', 'Hingyon', 'Tinoc'],
      'Kalinga': ['Balbalan', 'Lubuagan', 'Pasil', 'Pinukpuk', 'Rizal', 'Tabuk City', 'Tanudan', 'Tinglayan'],
      'Mountain Province': ['Barlig', 'Bauko', 'Besao', 'Bontoc', 'Natonin', 'Paracelis', 'Sabangan', 'Sadanga', 'Sagada', 'Tadian']
    }
  },
  'Region I - Ilocos Region': {
    provinces: {
      'Ilocos Norte': ['Laoag City', 'Batac City', 'Adams', 'Bacarra', 'Badoc', 'Bangui', 'Banna', 'Burgos', 'Carasi', 'Currimao', 'Dingras', 'Dumalneg', 'Paoay', 'Pasuquin', 'Piddig', 'Pinili', 'San Nicolas', 'Sarrat', 'Solsona', 'Vintar'],
      'Ilocos Sur': ['Candon City', 'Vigan City', 'Alilem', 'Banayoyo', 'Bantay', 'Burgos', 'Cabugao', 'Caoayan', 'Cervantes', 'Galimuyod', 'Gregorio del Pilar', 'Lidlidda', 'Magsingal', 'Nagbukel', 'Narvacan', 'Quirino', 'Salcedo', 'San Emilio', 'San Esteban', 'San Ildefonso', 'San Juan', 'San Vicente', 'Santa', 'Santa Catalina', 'Santa Cruz', 'Santa Lucia', 'Santa Maria', 'Santiago', 'Santo Domingo', 'Sigay', 'Sinait', 'Sugpon', 'Suyo', 'Tagudin'],
      'La Union': ['San Fernando City', 'Agoo', 'Aringay', 'Bacnotan', 'Bagulin', 'Balaroan', 'Bangar', 'Bauang', 'Burgos', 'Caba', 'Luna', 'Naguilian', 'Pugo', 'Rosario', 'San Gabriel', 'San Juan', 'Santo Tomas', 'Santol', 'Sudipen', 'Tubao'],
      'Pangasinan': ['Alaminos City', 'Dagupan City', 'San Carlos City', 'Urdaneta City', 'Agno', 'Aguilar', 'Alcala', 'Anda', 'Asingan', 'Balungao', 'Bani', 'Basista', 'Bautista', 'Bayambang', 'Binalonan', 'Binmaley', 'Bolinao', 'Bungalon', 'Calasiao', 'Dasol', 'Infanta', 'Labrador', 'Laoac', 'Lingayen', 'Mabini', 'Malasiqui', 'Manaoag', 'Mangaldan', 'Mangatarem', 'Mapandan', 'Natividad', 'Pozorrubio', 'Rosales', 'San Fabian', 'San Jacinto', 'San Manuel', 'San Nicolas', 'San Quintin', 'Santa Barbara', 'Santa Maria', 'Santo Tomas', 'Sison', 'Sual', 'Tayug', 'Umingan', 'Urbiztondo', 'Villasis']
    }
  },
  'Region II - Cagayan Valley': {
    provinces: {
      'Batanes': ['Basco', 'Itbayat', 'Ivana', 'Mahatao', 'Sabtang', 'Uyugan'],
      'Cagayan': ['Tuguegarao City', 'Abulug', 'Alcala', 'Allacapan', 'Amulung', 'Aparri', 'Baggao', 'Ballesteros', 'Buguey', 'Calayan', 'Camalaniugan', 'Claveria', 'Enrile', 'Gattaran', 'Gonzaga', 'Iguig', 'Lal-lo', 'Lasam', 'Pamplona', 'Peñablanca', 'Piat', 'Rizal', 'Sanchez-Mira', 'Santa Ana', 'Santa Praxedes', 'Santa Teresita', 'Santo Niño', 'Solana', 'Tuao'],
      'Isabela': ['Cauayan City', 'Ilagan City', 'Santiago City', 'Alicia', 'Angadanan', 'Aurora', 'Benito Soliven', 'Burgos', 'Cabagan', 'Cabaluan', 'Cordon', 'Delfin Albano', 'Dinapigue', 'Divilacan', 'Echague', 'Gamu', 'Jones', 'Maconacon', 'Mallig', 'Naguilian', 'Palanan', 'Quezon', 'Quirino', 'Ramon', 'Reina Mercedes', 'Roxas', 'San Agustin', 'San Guillermo', 'San Isidro', 'San Manuel', 'San Mariano', 'San Mateo', 'San Pablo', 'Santa Maria', 'Santo Tomas', 'Tumauini'],
      'Nueva Vizcaya': ['Bayombong', 'Ambaguio', 'Aritao', 'Bagabag', 'Bambang', 'Diadi', 'Dupax del Norte', 'Dupax del Sur', 'Kasibu', 'Kayapa', 'Kayapa', 'Santa Fe', 'Solano', 'Villaverde'],
      'Quirino': ['Cabarroguis', 'Aglipay', 'Diffun', 'Maddela', 'Nagtipunan', 'Saguday']
    }
  },
  'Region III - Central Luzon': {
    provinces: {
      'Aurora': ['Baler', 'Casiguran', 'Dilasag', 'Dinalungan', 'Dingalan', 'Dipaculao', 'Maria Aurora', 'San Luis'],
      'Bataan': ['Balanga City', 'Abucay', 'Bagac', 'Dinalupihan', 'Hermosa', 'Limay', 'Mariveles', 'Morong', 'Orani', 'Orion', 'Pilar', 'Samal'],
      'Bulacan': ['Malolos City', 'Meycauayan City', 'San Jose del Monte City', 'Angat', 'Balagtas', 'Baliwag', 'Bocaue', 'Bulakan', 'Bustos', 'Calumpit', 'Doña Remedios Trinidad', 'Guiguinto', 'Hagonoy', 'Marilao', 'Norzagaray', 'Obando', 'Pandi', 'Paombong', 'Plaridel', 'Pulilan', 'San Ildefonso', 'San Miguel', 'San Rafael', 'Santa Maria'],
      'Nueva Ecija': ['Cabanatuan City', 'Gapan City', 'Palayan City', 'San Jose City', 'Science City of Muñoz', 'Aliaga', 'Bongabon', 'Cabiao', 'Carranglan', 'Cuyapo', 'Gabaldon', 'General Mamerto Natividad', 'General Tinio', 'Guimba', 'Jaen', 'Laur', 'Licab', 'Llanera', 'Lupao', 'Nampicuan', 'Pantabangan', 'Peñaranda', 'Quezon', 'Rizal', 'San Antonio', 'San Isidro', 'San Leonardo', 'Santa Rosa', 'Santo Domingo', 'Talavera', 'Talugtug', 'Zaragoza'],
      'Pampanga': ['Angeles City', 'San Fernando City', 'Apalit', 'Arayat', 'Bacolor', 'Candaba', 'Floridablanca', 'Guagua', 'Lubao', 'Mabalacat City', 'Macabebe', 'Magalang', 'Masantol', 'Mexico', 'Minalin', 'Porac', 'San Luis', 'San Simon', 'Santa Ana', 'Santa Rita', 'Santo Tomas', 'Sasmuan'],
      'Tarlac': ['Tarlac City', 'Anaao', 'Bamban', 'Camiling', 'Capas', 'Concepcion', 'Gerona', 'La Paz', 'Mayantoc', 'Moncada', 'Paniqui', 'Pura', 'Ramos', 'San Clemente', 'San Jose', 'San Manuel', 'Santa Ignacia', 'Victoria'],
      'Zambales': ['Olongapo City', 'Botolan', 'Cabangan', 'Candelaria', 'Castillejos', 'Iba', 'Masinloc', 'Palauig', 'San Antonio', 'San Felipe', 'San Marcelino', 'San Narciso', 'Santa Cruz', 'Subic']
    }
  },
  'Region IV-A - CALABARZON': {
    provinces: {
      'Batangas': ['Batangas City', 'Lipa City', 'Tanauan City', 'Agoncillo', 'Alitagtag', 'Balayan', 'Balete', 'Bauan', 'Calaca City', 'Calatagan', 'Cuenca', 'Ibaan', 'Laurel', 'Lemery', 'Lian', 'Lobo', 'Mabini', 'Malvar', 'Mataasnakahoy', 'Nasugbu', 'Padre Garcia', 'Rosario', 'San Jose', 'San Juan', 'San Luis', 'San Nicolas', 'San Pascual', 'Santa Teresita', 'Santo Tomas City', 'Taal', 'Talisay', 'Taysan', 'Tingloy', 'Tuy'],
      'Cavite': ['Bacoor City', 'Cavite City', 'Dasmariñas City', 'General Trias City', 'Imus City', 'Tagaytay City', 'Trece Martires City', 'Alfonso', 'Amadeo', 'Carmona City', 'Indang', 'Kawit', 'Magallanes', 'Maragondon', 'Mendez', 'Naic', 'Noveleta', 'Rosario', 'Silang', 'Tanza', 'Ternate'],
      'Laguna': ['Biñan City', 'Cabuyao City', 'Calamba City', 'San Pablo City', 'Santa Rosa City', 'Alaminos', 'Bay', 'Calauan', 'Cavinti', 'Famy', 'Kalayaan', 'Liliw', 'Los Baños', 'Luisiana', 'Lumban', 'Mabitac', 'Magdalena', 'Majayjay', 'Nagcarlan', 'Paete', 'Pagsanjan', 'Pakil', 'Pangil', 'Pila', 'Rizal', 'San Pedro City', 'Santa Cruz', 'Santa Maria', 'Siniloan', 'Victoria'],
      'Quezon': ['Lucena City', 'Tayabas City', 'Agdangan', 'Alabat', 'Atimonan', 'Buenavista', 'Burdeos', 'Calauag', 'Candelaria', 'Catanauan', 'Dolores', 'General Nakar', 'Guinayangan', 'Gumaca', 'Infanta', 'Jomalig', 'Lopez', 'Lucban', 'Macalelon', 'Mauban', 'Mulanay', 'Padre Burgos', 'Paganiban', 'Panukulan', 'Patnanungan', 'Perez', 'Pitogo', 'Plaridel', 'Polillo', 'Quezon', 'Sampaloc', 'San Antonio', 'San Andres', 'San Francisco', 'San Narciso', 'Sariaya', 'Tagkawayan', 'Unisan'],
      'Rizal': ['Antipolo City', 'Angono', 'Baras', 'Binangonan', 'Cainta', 'Cardona', 'Jala-Jala', 'Morong', 'Pililla', 'Rodriguez', 'San Mateo', 'Tanay', 'Taytay', 'Teresa']
    }
  },
  'MIMAROPA Region': {
    provinces: {
      'Marinduque': ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos'],
      'Occidental Mindoro': ['Mamburao', 'Abra de Ilog', 'Calintaan', 'Looc', 'Lubang', 'Magsaysay', 'Paluan', 'Rizal', 'Sablayan', 'San Jose', 'Santa Cruz'],
      'Oriental Mindoro': ['Calapan City', 'Baco', 'Bansud', 'Bongabong', 'Bulalacao', 'Gloria', 'Mansalay', 'Naujan', 'Pinamalayan', 'Pola', 'Puerto Galera', 'Roxas', 'San Teodoro', 'Socorro', 'Victoria'],
      'Palawan': ['Puerto Princesa City', 'Aborlan', 'Agutaya', 'Araceli', 'Balabac', 'Bataraza', 'Brooke\'s Point', 'Busuanga', 'Cagayancillo', 'Coron', 'Culion', 'Cuyo', 'Dumaran', 'El Nido', 'Kalayaan', 'Linapacan', 'Magsaysay', 'Narra', 'Quezon', 'Rizal', 'Roxas', 'San Vicente', 'Sofronio Española', 'Taytay'],
      'Romblon': ['Romblon', 'Alcantara', 'Banton', 'Cajidiocan', 'Calatrava', 'Concepcion', 'Corcuera', 'Ferrol', 'Looc', 'Magdiwang', 'San Agustin', 'San Andres', 'San Fernando', 'San Jose', 'Santa Fe', 'Santa Maria']
    }
  },
  'Region V - Bicol Region': {
    provinces: {
      'Albay': ['Legazpi City', 'Ligao City', 'Tabaco City', 'Bacacay', 'Camalig', 'Daraga', 'Guinobatan', 'Jovellar', 'Libon', 'Malilipot', 'Malinao', 'Manito', 'Oas', 'Pio Duran', 'Polangui', 'Santo Domingo', 'Tiwi'],
      'Camarines Norte': ['Daet', 'Basud', 'Capalonga', 'Jose Panganiban', 'Labo', 'Mercedes', 'Paracale', 'San Lorenzo Ruiz', 'San Vicente', 'Santa Elena', 'Talisay', 'Vizons'],
      'Camarines Sur': ['Iriga City', 'Naga City', 'Baao', 'Balatan', 'Bato', 'Bombon', 'Buhi', 'Bula', 'Cabalonga', 'Calabanga', 'Camaligan', 'Canaman', 'Caramoan', 'Del Gallego', 'Gainza', 'Garchitorena', 'Goa', 'Lagonoy', 'Libmanan', 'Lupi', 'Magarao', 'Milaor', 'Minalabac', 'Nabua', 'Ocampo', 'Pamplona', 'Pasacao', 'Pili', 'Presentacion', 'Ragay', 'Sagñay', 'San Fernando', 'San Jose', 'Sipocot', 'Siruma', 'Tigaon', 'Tinambac'],
      'Catanduanes': ['Virac', 'Bagamanoc', 'Baras', 'Bato', 'Caramoran', 'Gigmoto', 'Pandan', 'Panganiban', 'San Andres', 'San Miguel', 'Viga'],
      'Masbate': ['Masbate City', 'Aroroy', 'Baleno', 'Balud', 'Batuan', 'Cataingan', 'Cawayan', 'Claveria', 'Dimasalang', 'Esperanza', 'Mandaon', 'Milagros', 'Mobo', 'Monreal', 'Palanas', 'Pio V. Corpuz', 'Placer', 'San Fernando', 'San Jacinto', 'San Pascual', 'Uson'],
      'Sorsogon': ['Sorsogon City', 'Barcelona', 'Bulan', 'Bulusan', 'Casiguran', 'Castilla', 'Donsol', 'Gubat', 'Irosin', 'Juban', 'Magallanes', 'Matnog', 'Pilar', 'Prieto Diaz', 'Santa Magdalena']
    }
  },
  'Region VI - Western Visayas': {
    provinces: {
      'Aklan': ['Kalibo', 'Altavas', 'Balete', 'Banga', 'Batan', 'Buruanga', 'Ibajay', 'Lezo', 'Libacao', 'Madalag', 'Makato', 'Malay', 'Malinao', 'Nabas', 'New Washington', 'Numancia', 'Tangalan'],
      'Antique': ['San Jose de Buenavista', 'Anini-y', 'Barbaza', 'Belison', 'Bugasong', 'Caluya', 'Culat', 'Hamtic', 'Laua-an', 'Libertad', 'Pandan', 'Patnongon', 'San Remigio', 'Sebaste', 'Sibalom', 'Tibiao', 'Tobias Fornier', 'Valderrama'],
      'Capiz': ['Roxas City', 'Cuartero', 'Dao', 'Dumalag', 'Dumarao', 'Ivisan', 'Jamindan', 'Maayon', 'Mambusao', 'Panay', 'Panitan', 'Pilar', 'Pontevedra', 'President Roxas', 'Sapian', 'Sigma', 'Tapaz'],
      'Guimaras': ['Jordan', 'Buenavista', 'Nueva Valencia', 'San Lorenzo', 'Sibunag'],
      'Iloilo': ['Iloilo City', 'Passi City', 'Ajuy', 'Alimodian', 'Anilao', 'Badiangan', 'Balasan', 'Barotac Nuevo', 'Barotac Viejo', 'Batad', 'Bingawan', 'Cabanatuan', 'Calinog', 'Carles', 'Concepcion', 'Dingle', 'Dueñas', 'Dumangas', 'Estancia', 'Guimbal', 'Igbaras', 'Janiuay', 'Lambunao', 'Leganes', 'Lemery', 'Leon', 'Maasin', 'Miagao', 'Mina', 'New Lucena', 'Oton', 'Pavia', 'Pototan', 'San Dionisio', 'San Enrique', 'San Joaquin', 'San Miguel', 'San Rafael', 'Santa Barbara', 'Sara', 'Tigbauan', 'Tubungan', 'Zarraga'],
      'Negros Occidental': ['Bacolod City', 'Bago City', 'Cadiz City', 'Escalante City', 'Himamaylan City', 'Kabankalan City', 'La Carlota City', 'Sagay City', 'San Carlos City', 'Silay City', 'Sipalay City', 'Talisay City', 'Victorias City', 'Binalbagan', 'Calatrava', 'Candoni', 'Cauayan', 'Enrique B. Magalona', 'Hinigaran', 'Hinoba-an', 'Ilog', 'Isabela', 'La Castellana', 'Manapla', 'Moises Padilla', 'Pontevedra', 'Pulupandan', 'San Enrique', 'Toboso', 'Valladolid']
    }
  },
  'Region VII - Central Visayas': {
    provinces: {
      'Bohol': ['Tagbilaran City', 'Alburquerque', 'Alicia', 'Anda', 'Antequera', 'Baclayon', 'Balilihan', 'Batuan', 'Bien Unido', 'Bilar', 'Buenavista', 'Calape', 'Candijay', 'Carmen', 'Catigbian', 'Clarin', 'Corella', 'Cortes', 'Dagohoy', 'Danao', 'Dauis', 'Dimiao', 'Duero', 'Garcia Hernandez', 'Getafe', 'Guindulman', 'Inabanga', 'Jagna', 'Lila', 'Loay', 'L形', 'Loon', 'Mabini', 'Maribojoc', 'Panglao', 'Pilar', 'President Carlos P. Garcia', 'Sagbayan', 'San Isidro', 'San Miguel', 'Sevilla', 'Sierra Bullones', 'Sikatuna', 'Talibon', 'Trinidad', 'Tubigon', 'Ubay', 'Valencia'],
      'Cebu': ['Cebu City', 'Lapu-Lapu City', 'Mandaue City', 'Bogo City', 'Carcar City', 'Danao City', 'Naga City', 'Talisay City', 'Toledo City', 'Alcantara', 'Alcoy', 'Alegria', 'Aloguinsan', 'Argao', 'Asturias', 'Badian', 'Balamban', 'Bantayan', 'Barili', 'Bogo', 'Boljoon', 'Borbon', 'Carmen', 'Catmon', 'Compostela', 'Consolacion', 'Cordova', 'Daanbantayan', 'Dalaguete', 'Dumanjug', 'Ginatilan', 'Liloan', 'Madridejos', 'Malabuyoc', 'Medellin', 'Minglanilla', 'Moalboal', 'Oslob', 'Pilar', 'Pinamungajan', 'Poro', 'Ronda', 'Samboan', 'San Fernando', 'San Francisco', 'San Remigio', 'Santa Fe', 'Santander', 'Sibonga', 'Sogod', 'Tabogon', 'Tabuelan', 'Tuburan', 'Tudela'],
      'Negros Oriental': ['Bais City', 'Bayawan City', 'Canlaon City', 'Dumaguete City', 'Guihulngan City', 'Tanjay City', 'Amlan', 'Ayungon', 'Bacong', 'Basay', 'Bindoy', 'Dauin', 'Jimalalud', 'La Libertad', 'Mabinay', 'Manjuyod', 'Pamplona', 'San Jose', 'Santa Catalina', 'Siaton', 'Sibulan', 'Tayasan', 'Valencia', 'Vallehermoso', 'Zamboanguita'],
      'Siquijor': ['Siquijor', 'Enrique Villanueva', 'Larena', 'Lazi', 'Maria', 'San Juan']
    }
  },
  'Region VIII - Eastern Visayas': {
    provinces: {
      'Biliran': ['Naval', 'Almeria', 'Biliran', 'Cabucgayan', 'Caibiran', 'Culaba', 'Kawayan', 'Maripipi'],
      'Eastern Samar': ['Borongan City', 'Arteche', 'Balangiga', 'Balangkayan', 'Can-avid', 'Dolores', 'General MacArthur', 'Giporlos', 'Guiuan', 'Hernani', 'Jipapad', 'Lawaan', 'Llorente', 'Maslog', 'Maydolong', 'Mercedes', 'Oras', 'Quinapondan', 'Salcedo', 'San Policarpo', 'Sulat', 'Taft'],
      'Leyte': ['Tacloban City', 'Ormoc City', 'Baybay City', 'Abuyog', 'Alangalang', 'Albuera', 'Bato', 'Burauen', 'Calubian', 'Capoocan', 'Carigara', 'Dagami', 'Dulag', 'Hilongos', 'Hindang', 'Inopacan', 'Isabel', 'Jaro', 'Javier', 'Julita', 'Kananga', 'La Paz', 'Leyte', 'MacArthur', 'Mahaplag', 'Matag-ob', 'Matalom', 'Mayorga', 'Merida', 'Palo', 'Palompon', 'Pastrana', 'San Isidro', 'San Miguel', 'Santa Fe', 'Tabango', 'Tabontabon', 'Tanauan', 'Tolosa', 'Tunga', 'Villaba'],
      'Northern Samar': ['Catarman', 'Allen', 'Biri', 'Bobon', 'Capul', 'Catubig', 'Gamay', 'Laoang', 'Lapinig', 'Las Navas', 'Lavezares', 'Lope de Vega', 'Mapanas', 'Mondragon', 'Palapag', 'Pambujan', 'Rosario', 'San Antonio', 'San Isidro', 'San Jose', 'San Roque', 'San Vicente', 'Silvino Lobos', 'Victoria'],
      'Samar': ['Calbayog City', 'Catbalogan City', 'Almagro', 'Basey', 'Calbiga', 'Daram', 'Gandara', 'Hinabangan', 'Jiabong', 'Marabut', 'Matuguinao', 'Motiong', 'Pagsanghan', 'Paranas', 'Pinabacdao', 'San Jorge', 'San Jose de Buan', 'San Sebastian', 'Santa Margarita', 'Santa Rita', 'Santo Niño', 'Tagapul-an', 'Talalora', 'Tarangnan', 'Villareal', 'Zumarraga'],
      'Southern Leyte': ['Maasin City', 'Anahawan', 'Bontoc', 'Hinunangan', 'Hinundayan', 'Libagon', 'Liloan', 'Limanawa', 'Malitbog', 'Padre Burgos', 'Pintuyan', 'San Francisco', 'San Juan', 'San Ricardo', 'Silago', 'Sogod', 'Tomas Oppus']
    }
  },
  'Region IX - Zamboanga Peninsula': {
    provinces: {
      'Zamboanga del Norte': ['Dapitan City', 'Dipolog City', 'Bacungan', 'Baliguian', 'Godod', 'Gutalac', 'Jose Dalman', 'Kalawit', 'Katipunan', 'La Libertad', 'Labason', 'Liloy', 'Manukan', 'Mutia', 'Piñan', 'Polanco', 'President Manuel A. Roxas', 'Rizal', 'Salug', 'Sergio Osmeña Sr.', 'Siayan', 'Sibuco', 'Sibatog', 'Sindangan', 'Siocon', 'Sirawai', 'Tampilisan'],
      'Zamboanga del Sur': ['Pagadian City', 'Zamboanga City', 'Aurora', 'Bayog', 'Dimataling', 'Dinas', 'Dumas', 'Guipos', 'Josefina', 'Kumalarang', 'Labangan', 'Lakewood', 'Lapuyan', 'Mahayag', 'Margosatubig', 'Midsalip', 'Molave', 'Pitogo', 'Ramon Magsaysay', 'San Miguel', 'San Pablo', 'Sominot', 'Tabina', 'Tamboanga', 'Tigbao', 'Tukuran', 'Vincenzo A. Sagun'],
      'Zamboanga Sibugay': ['Ipil', 'Alicia', 'Buug', 'Diplahan', 'Imelda', 'Kabasalan', 'Mabuhay', 'Malangas', 'Naga', 'Olutanga', 'Payao', 'Roseller Lim', 'Siay', 'Talusan', 'Titay', 'Tungawan']
    }
  },
  'Region X - Northern Mindanao': {
    provinces: {
      'Bukidnon': ['Malaybalay City', 'Valencia City', 'Baungon', 'Cabanglasan', 'Damulog', 'Dangcagan', 'Don Carlos', 'Impasugong', 'Kadingilan', 'Kibawe', 'Kitaotao', 'Lantapan', 'Libona', 'Malitbog', 'Manolo Fortich', 'Maramag', 'Pangantucan', 'Quezon', 'San Fernando', 'Sumilao', 'Talakag'],
      'Camiguin': ['Mambajao', 'Catarman', 'Guinsiliban', 'Mahinog', 'Sagay'],
      'Lanao del Norte': ['Iligan City', 'Bacolod', 'Baloi', "Baroy", 'Kapatagan', 'Kauswagan', 'Lala', 'Linamon', 'Magsaysay', 'Maigo', 'Matungao', 'Munai', 'Nunungan', 'Pantao Ragat', 'Pantar', 'Poona Piagapo', 'Salvador', 'Sapad', 'Sultan Naga Dimaporo', 'Tagoloan', 'Tangcal', 'Tubod'],
      'Misamis Occidental': ['Oroquieta City', 'Ozamiz City', 'Tangub City', 'Aloran', 'Baliangao', 'Bonifacio', 'Calamba', 'Clarin', 'Concepcion', 'Don Victoriano Chiongbian', 'Jimenez', 'Lopez Jaena', 'Panaon', 'Plaridel', 'Sapang Dalaga', 'Sinacaban', 'Tudela'],
      'Misamis Oriental': ['Cagayan de Oro City', 'El Salvador City', 'Gingoog City', 'Alubijid', 'Balingasag', 'Balingoan', 'Binuangan', 'Claveria', 'Gitagum', 'Initao', 'Jasaan', 'Kinoguitan', 'Lagonglong', 'Laguindingan', 'Libertad', 'Lugait', 'Magsaysay', 'Manticao', 'Medina', 'Naawan', 'Opol', 'Salay', 'Sugbongcogon', 'Tagoloan', 'Talisayan', 'Villanueva']
    }
  },
  'Region XI - Davao Region': {
    provinces: {
      'Davao de Oro': ['Nabunturan', 'Compostela', 'Laak', 'Mabini', 'Maco', 'Maragusan', 'Mawab', 'Monkayo', 'Montevista', 'New Bataan', 'Pantukan'],
      'Davao del Norte': ['Panabo City', 'Samal City', 'Tagum City', 'Asuncion', 'Braulio E. Dujali', 'Carmen', 'Kapalong', 'New Corella', 'San Isidro', 'Santo Tomas', 'Talaingod'],
      'Davao del Sur': ['Davao City', 'Digos City', 'Bansalan', 'Hagonoy', 'Kiblawan', 'Magsaysay', 'Malalag', 'Matanao', 'Padada', 'Santa Cruz', 'Sulop'],
      'Davao Occidental': ['Malita', 'Don Marcelino', 'Jose Abad Santos', 'Sarangani', 'Santa Maria'],
      'Davao Oriental': ['Mati City', 'Baganga', 'Banaybanay', 'Boston', 'Caraga', 'Cateel', 'Governor Generoso', 'Lupon', 'Manay', 'San Isidro', 'Tarragona']
    }
  },
  'Region XII - SOCCSKSARGEN': {
    provinces: {
      'Cotabato': ['Kidapawan City', 'Alamada', 'Aleosan', 'Antipas', 'Arakan', 'Banisilan', 'Carmen', 'Kabacan', 'Libungan', 'Magpet', 'Makilala', 'Matalam', 'Midsayap', 'M\'lang', 'Pigcawayan', 'Pikit', 'President Roxas', 'Tulunan'],
      'Sarangani': ['Alabel', 'Glan', 'Kiamba', 'Maasim', 'Maitum', 'Malapatan', 'Malungon'],
      'South Cotabato': ['General Santos City', 'Koronadal City', 'Banga', 'Lutayan', 'Norala', 'Polomolok', 'Santo Niño', 'Surallah', 'T\'Boli', 'Tampakan', 'Tantangan', 'Tupi'],
      'Sultan Kudarat': ['Tacurong City', 'Bagumbayan', 'Columbio', 'Esperanza', 'Isulan', 'Kalamansig', 'Lebak', 'Lutayan', 'Lambayong', 'Palimbang', 'President Quirino', 'Sen. Ninoy Aquino']
    }
  },
  'Region XIII - Caraga': {
    provinces: {
      'Agusan del Norte': ['Butuan City', 'Cabadbaran City', 'Buenavista', 'Carmen', 'Jabonga', 'Kitcharao', 'Las Nieves', 'Magallanes', 'Nasipit', 'Remedios T. Romualdez', 'Santiago', 'Tubay'],
      'Agusan del Sur': ['Bayugan City', 'Bunawan', 'Esperanza', 'La Paz', 'Loreto', 'Prosperidad', 'Rosario', 'San Francisco', 'San Luis', 'Santa Josefa', 'Sibagat', 'Talacogon', 'Trento', 'Veruela'],
      'Dinagat Islands': ['San Jose', 'Basilisa', 'Cagdianao', 'Dinagat', 'Libjo', 'Loreto', 'Tubajon'],
      'Surigao del Norte': ['Surigao City', 'Alegria', 'Bacuag', 'Burgos', 'Claver', 'Dapa', 'Del Carmen', 'General Luna', 'Gigaquit', 'Mainit', 'Malimono', 'Pilar', 'Placer', 'San Benito', 'San Francisco', 'San Isidro', 'Santa Monica', 'Sison', 'Socorro', 'Tagana-an', 'Tubod'],
      'Surigao del Sur': ['Bislig City', 'Tandag City', 'Barobo', 'Bayabas', 'Cagwait', 'Cantilan', 'Carmen', 'Carrascal', 'Cortes', 'Hinatuan', 'Lanuza', 'Lianga', 'Lingig', 'Madrid', 'Marihatag', 'San Agustin', 'San Miguel', 'Tagbina', 'Tago']
    }
  },
  'BARMM - Bangsamoro Autonomous Region in Muslim Mindanao': {
    provinces: {
      'Basilan': ['Isabela City', 'Lamitan City', 'Akbar', 'Al-Barka', 'Hadji Mohammad Ajul', 'Hadji Muhtamad', 'Lantawan', 'Maluso', 'Sumisip', 'Tabuan-Lasa', 'Tipo-Tipo', 'Tuburan', 'Ungkaya Pukan'],
      'Lanao del Sur': ['Marawi City', 'Bacolod-Kalawi', 'Balabagan', 'Balindong', 'Bayang', 'Binidayan', 'Buadiposo-Buntong', 'Bubong', 'Bumbaran', 'Butig', 'Calanogas', 'Ditsaan-Ramain', 'Ganassi', 'Kapai', 'Katai', 'Lumba-Bayabao', 'Lumbaca-Unayan', 'Lumbatan', 'Lumbayanague', 'Madalum', 'Madamba', 'Maguing', 'Malabang', 'Marantao', 'Marogong', 'Masiu', 'Mulondo', 'Pagayawan', 'Piagapo', 'Picong', 'Poona Bayabao', 'Pualas', 'Saguiaran', 'Sultan Dumalondong', 'Tagoloan II', 'Tamparan', 'Taraka', 'Tubaran', 'Tugaya', 'Wao'],
      'Maguindanao del Norte': ['Cotabato City', 'Barira', 'Buldon', 'Datu Blah T. Sinsuat', 'Datu Odin Sinsuat', 'Kabuntalan', 'Matanog', 'Northern Kabuntalan', 'Parang', 'San Martin', 'Upi'],
      'Maguindanao del Sur': ['Ampatuan', 'Buldun', 'Datu Abdullah Sangki', 'Datu Anggal Midtimbang', 'Datu Hoffer Ampatuan', 'Datu Paglas', 'Datu Salibo', 'Datu Saudi-Ampatuan', 'Datu Unsay', 'Gen. S.K. Pendatun', 'Guindulungan', 'Mamasapano', 'Mangudadatu', 'Pagalungan', 'Paglat', 'Pandag', 'Rajah Buayan', 'Shariff Aguak', 'Shariff Saydona Mustapha', 'South Upi', 'Sultan sa Barongis', 'Sultan Sumagka', 'Talayan'],
      'Sulu': ['Jolo', 'Banguingui', 'Hadji Panglima Tahil', 'Indanan', 'Kalingalan Caluang', 'Lugus', 'Luuk', 'Maimbung', 'Old Panamao', 'Omar', 'Pandami', 'Panglima Estino', 'Pangutaran', 'Parang', 'Pata', 'Patikul', 'Siasi', "Talipao", 'Tapul'],
      'Tawi-Tawi': ['Bongao', 'Languyan', 'Mapun', 'Simunul', 'Sitangkai', 'South Ubian', 'Tandubas', 'Turtle Islands']
    }
  }
};

export function OnboardingForm({ onComplete }) {
  const navigate = useNavigate();
  const { user, token: contextToken, updateUser } = useAuth();

  const [formData, setFormData] = useState({
    dob: '',
    course: '',
    academicLevel: 'College',
    yearLevel: '1st Year',
    gpa: '',
    region: 'NCR - National Capital Region',
    province: 'Metro Manila',
    municipalityCity: 'Quezon City',
    householdIncome: 'Below ₱10,000 / month',
    guardianName: '',
    guardianEmail: '',
    // Special Eligibility Tags
    isIndigenous: false,
    isPWD: false,
    isSoloParentChild: false,
    isOrphan: false,
    isFarmerfolkChild: false,
    isWorkingStudent: false,
    isOFWChild: false,
    is4psBeneficiary: false,
    dpaConsent: false
  });

  const [isMinor, setIsMinor] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentSent, setConsentSent] = useState(false);
  const [error, setError] = useState(null);

  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

  // Derived location state options
  const currentRegionProvinces = PHILIPPINE_LOCATIONS[formData.region]?.provinces || {};
  const provinceList = Object.keys(currentRegionProvinces);
  const cityList = currentRegionProvinces[formData.province] || [];

  const handleRegionChange = (e) => {
    const selectedRegion = e.target.value;
    const availableProvinces = Object.keys(PHILIPPINE_LOCATIONS[selectedRegion]?.provinces || {});
    const defaultProvince = availableProvinces[0] || '';
    const defaultCities = PHILIPPINE_LOCATIONS[selectedRegion]?.provinces[defaultProvince] || [];
    const defaultCity = defaultCities[0] || '';

    setFormData(prev => ({
      ...prev,
      region: selectedRegion,
      province: defaultProvince,
      municipalityCity: defaultCity
    }));
  };

  const handleProvinceChange = (e) => {
    const selectedProvince = e.target.value;
    const availableCities = PHILIPPINE_LOCATIONS[formData.region]?.provinces[selectedProvince] || [];
    const defaultCity = availableCities[0] || '';

    setFormData(prev => ({
      ...prev,
      province: selectedProvince,
      municipalityCity: defaultCity
    }));
  };

  const handleDobChange = (e) => {
    const dobValue = e.target.value;
    setFormData(prev => ({ ...prev, dob: dobValue }));

    if (dobValue) {
      const birthDate = new Date(dobValue);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      setCalculatedAge(age);
      setIsMinor(age < 18);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const getCleanToken = () => {
    let rawToken = contextToken || localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (rawToken) {
      return rawToken.replace(/^"|"$/g, '').replace('Bearer ', '').trim();
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.dpaConsent) {
      setError('You must consent to the Data Privacy Act (DPA) policy to proceed.');
      return;
    }

    if (isMinor) {
      const studentEmail = user?.email?.trim().toLowerCase();
      const guardianEmail = formData.guardianEmail.trim().toLowerCase();

      if (!guardianEmail) {
        setError('Guardian email is required for students under 18.');
        return;
      }

      if (studentEmail && guardianEmail === studentEmail) {
        setError('Parent/Guardian email cannot be the same as your student account email.');
        return;
      }
    }

    const gwa = parseFloat(formData.gpa);

    if (isNaN(gwa)) {
      setError('Please enter a valid GWA.');
      return;
    }

    let gwaScale;
    if (gwa >= 1 && gwa <= 5) {
      gwaScale = '1.00-5.00';
    } else if (gwa >= 60 && gwa <= 100) {
      gwaScale = '60-100';
    } else {
      setError('GWA must be between 1.00–5.00 or 60–100.');
      return;
    }

    setIsSubmitting(true);
    const token = getCleanToken();

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/students/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
        body: JSON.stringify({
          dob: formData.dob,
          course: formData.course,
          academicLevel: formData.academicLevel,
          yearLevel: formData.yearLevel,
          gpa: gwa,
          gwaScale: gwaScale,
          region: formData.region,
          province: formData.province,
          municipalityCity: formData.municipalityCity,
          householdIncome: formData.householdIncome,
          guardianName: isMinor ? formData.guardianName : undefined,
          guardianEmail: isMinor ? formData.guardianEmail : undefined,
          // Eligibility flags
          isIndigenous: formData.isIndigenous,
          isPWD: formData.isPWD,
          isSoloParentChild: formData.isSoloParentChild,
          isOrphan: formData.isOrphan,
          isFarmerfolkChild: formData.isFarmerfolkChild,
          isWorkingStudent: formData.isWorkingStudent,
          isOFWChild: formData.isOFWChild,
          is4psBeneficiary: formData.is4psBeneficiary,
          isMinor,
          age: calculatedAge
        })
      });

      const contentType = response.headers.get('content-type');
      let data = {};
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const rawText = await response.text();
        console.error('Non-JSON Server Response:', rawText);
        throw new Error(`Server returned non-JSON response (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.message || 'Onboarding submission failed.');
      }

      if (typeof updateUser === 'function') {
        updateUser({ ...(data.user || user), isOnboarded: true });
      }

      if (isMinor) {
        setConsentSent(true);
      } else {
        if (typeof onComplete === 'function') {
          onComplete(data.profile || data.data);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error('Onboarding Submission Error:', err);
      setError(err.message || 'Connection Failed: Could not complete onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConsentEmail = async () => {
    setIsResending(true);
    setResendStatus(null);
    const token = getCleanToken();

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/consent/resend`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
        body: JSON.stringify({ 
          userId: user?.id || user?._id, 
          guardianEmail: formData.guardianEmail || user?.guardianEmail 
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setResendStatus({ type: 'success', text: 'Consent email sent successfully! Please check spam folder.' });
      } else {
        setResendStatus({ type: 'error', text: data.message || 'Failed to resend email.' });
      }
    } catch (err) {
      console.error('Resend Error:', err);
      setResendStatus({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsResending(false);
    }
  };

  if (user?.isOnboarded && user?.status === 'pending_consent') {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-card-bg border border-app-text/10 rounded-2xl text-center space-y-4 shadow-lg">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Mail className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-black text-app-text">Parental Approval Needed</h3>
        <p className="text-xs text-text-muted leading-relaxed">
          A verification link was sent to your parent/guardian's email address (<strong>{user?.guardianEmail}</strong>).
        </p>

        {resendStatus && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            resendStatus.type === 'success' 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{resendStatus.text}</span>
          </div>
        )}

        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleResendConsentEmail}
            disabled={isResending}
            className="w-full py-3 bg-primary text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isResending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                <Send className="w-4 h-4" />
                <span>Resend Consent Email</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/auth?mode=signin')}
            className="w-full py-2 text-xs font-semibold text-text-muted hover:text-app-text cursor-pointer"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (consentSent) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-card-bg border border-app-text/10 rounded-2xl text-center space-y-4 shadow-lg">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <MailCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-app-text">Parental Consent Required</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          Because you are under 18, we sent a verification link to <strong className="text-app-text">{formData.guardianEmail}</strong>.
        </p>
        <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs font-semibold border border-amber-200">
          🔒 Account Status: <strong>Pending Consent</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto my-10 p-6 sm:p-8 bg-card-bg border border-app-text/10 rounded-2xl shadow-md">
      <div className="mb-6 pb-4 border-b border-app-text/10 space-y-1">
        <h2 className="text-xl font-extrabold text-app-text flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-primary" />
          Complete Your Student Profile
        </h2>
        
        <div className="flex items-start gap-2 p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-blue-900 text-xs">
          <Sparkles className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
          <span>
            <strong>Scholarship Accuracy Notice:</strong> Please enter your accurate age, GPA, and location. Providers use these metrics to match you directly with eligible grant programs.
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-bold text-app-text">Date of Birth</label>
            {calculatedAge !== null && (
              <span className="text-xs font-bold text-primary">Age: {calculatedAge} years old</span>
            )}
          </div>
          <input
            type="date"
            name="dob"
            value={formData.dob}
            onChange={handleDobChange}
            required
            className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none"
          />
        </div>

        {isMinor && (
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Parent / Guardian Consent Required (Under 18)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-app-text mb-1">Guardian Full Name</label>
                <input
                  type="text"
                  name="guardianName"
                  value={formData.guardianName}
                  onChange={handleChange}
                  required={isMinor}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-app-text mb-1">Guardian Email Address</label>
                <input
                  type="email"
                  name="guardianEmail"
                  value={formData.guardianEmail}
                  onChange={handleChange}
                  required={isMinor}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Course / Major</label>
            <input
              type="text"
              name="course"
              value={formData.course}
              onChange={handleChange}
              required
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Academic Level</label>
            <select
              name="academicLevel"
              value={formData.academicLevel}
              onChange={(e) => {
                const academicLevel = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  academicLevel,
                  yearLevel:
                    academicLevel === 'Senior High School'
                      ? 'Grade 11'
                      : academicLevel === 'College'
                        ? '1st Year'
                        : 'Masteral'
                }));
              }}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer"
            >
              <option value="Senior High School">Senior High School</option>
              <option value="College">College</option>
              <option value="Graduate Studies">Post Graduate Studies</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">
              {formData.academicLevel === 'Senior High School'
                ? 'Grade Level'
                : formData.academicLevel === 'Graduate Studies'
                  ? 'Program Level'
                  : 'Year Level'}
            </label>

            <select
              name="yearLevel"
              value={formData.yearLevel}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer"
            >
              {formData.academicLevel === 'Senior High School' ? (
                <>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                </>
              ) : formData.academicLevel === 'Graduate Studies' ? (
                <>
                  <option value="Masteral">Master's</option>
                  <option value="Doctoral">Doctoral</option>
                </>
              ) : (
                <>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Current GWA / GPA</label>
            <input
              type="number"
              step="0.01"
              min="1"
              max="100"
              name="gpa"
              value={formData.gpa}
              onChange={handleChange}
              required
              placeholder="e.g. 1.75 or 85"
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Enter your GWA using your school's grading scale (1.00–5.00 or 60–100).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Region</label>
            <select
              name="region"
              value={formData.region}
              onChange={handleRegionChange}
              required
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer"
            >
              {Object.keys(PHILIPPINE_LOCATIONS).map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Province</label>
            <select
              name="province"
              value={formData.province}
              onChange={handleProvinceChange}
              required
              disabled={!provinceList.length}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer disabled:opacity-50"
            >
              {provinceList.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">City / Municipality</label>
            <select
              name="municipalityCity"
              value={formData.municipalityCity}
              onChange={handleChange}
              required
              disabled={!cityList.length}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer disabled:opacity-50"
            >
              {cityList.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text mb-1">Monthly Household Income</label>
            <select
              name="householdIncome"
              value={formData.householdIncome}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:border-primary focus:outline-none cursor-pointer"
            >
              <option>Below ₱10,000 / month</option>
              <option>₱10,001 – ₱21,190 / month</option>
              <option>₱21,191 – ₱43,828 / month</option>
              <option>₱43,829 – ₱76,669 / month</option>
              <option>₱76,670 – ₱131,484 / month</option>
              <option>Above ₱131,484 / month</option>
            </select>
          </div>
        </div>

        {/* Special Eligibility Tags */}
        <div className="p-4 bg-app-bg border border-app-text/10 rounded-xl space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-app-text/10">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-app-text">Special Eligibility Characteristics</h3>
              <p className="text-[10px] text-slate-500">Check all that apply. These unlock specialized government and NGO scholarships.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2.5 p-2 bg-card-bg rounded-lg border border-app-text/5 cursor-pointer hover:border-primary/30 transition-colors">
              <input
                type="checkbox"
                name="isIndigenous"
                checked={formData.isIndigenous}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-app-text">Indigenous People (IP)</span>
            </label>

            <label className="flex items-center gap-2.5 p-2 bg-card-bg rounded-lg border border-app-text/5 cursor-pointer hover:border-primary/30 transition-colors">
              <input
                type="checkbox"
                name="isPWD"
                checked={formData.isPWD}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-app-text">Person with Disability (PWD)</span>
            </label>

            <label className="flex items-center gap-2.5 p-2 bg-card-bg rounded-lg border border-app-text/5 cursor-pointer hover:border-primary/30 transition-colors">
              <input
                type="checkbox"
                name="isSoloParentChild"
                checked={formData.isSoloParentChild}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-app-text">Child of a Solo Parent</span>
            </label>

      
            <label className="flex items-center gap-2.5 p-2 bg-card-bg rounded-lg border border-app-text/5 cursor-pointer hover:border-primary/30 transition-colors">
              <input
                type="checkbox"
                name="isFarmerfolkChild"
                checked={formData.isFarmerfolkChild}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-app-text">Child of Farmer / Fisherfolk</span>
            </label>

            <label className="flex items-center gap-2.5 p-2 bg-card-bg rounded-lg border border-app-text/5 cursor-pointer hover:border-primary/30 transition-colors">
              <input
                type="checkbox"
                name="isWorkingStudent"
                checked={formData.isWorkingStudent}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-app-text">Working Student</span>
            </label>

            <label className="flex items-center gap-2.5 p-2 bg-card-bg rounded-lg border border-app-text/5 cursor-pointer hover:border-primary/30 transition-colors">
              <input
                type="checkbox"
                name="isOFWChild"
                checked={formData.isOFWChild}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-app-text">Child of an OFW</span>
            </label>

            <label className="flex items-center gap-2.5 p-2 bg-card-bg rounded-lg border border-app-text/5 cursor-pointer hover:border-primary/30 transition-colors">
              <input
                type="checkbox"
                name="is4psBeneficiary"
                checked={formData.is4psBeneficiary}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-app-text">4Ps Beneficiary</span>
            </label>
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="dpaConsent"
              name="dpaConsent"
              checked={formData.dpaConsent}
              onChange={handleChange}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <label htmlFor="dpaConsent" className="text-xs text-app-text leading-relaxed cursor-pointer">
              <strong className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 inline text-primary" /> Data Privacy Act (DPA) Compliance Notice
              </strong>
              I consent to the collection and processing of my personal data for scholarship matching purposes in compliance with Republic Act No. 10173 (Data Privacy Act of 2012).
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-4 py-3 bg-primary text-white hover:bg-primary/90 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>{isMinor ? 'Submit & Send Guardian Email' : 'Activate Profile'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default OnboardingForm;