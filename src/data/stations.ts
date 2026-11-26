// Isi kelima dermaga. Setiap klaim faktual di sini bersumber dari daftar
// `sources` milik dermaga yang sama.

export interface Source {
  label: string;
  url?: string;
}

export interface Station {
  id: string;
  num: number;
  roman: string;
  title: string;
  sila: string;
  silaShort: string;
  value: string;
  place: string;
  clock: string;
  story: string[];
  note: string;
  action: string;
  actionHint: string;
  reflect: string;
  sources: Source[];
}

export const stations: Station[] = [
  {
    id: 'dermaga-1',
    num: 1,
    roman: 'I',
    title: 'Satu Atap, Tiga Akar',
    sila: 'Ketuhanan Yang Maha Esa',
    silaShort: 'Sila pertama',
    value: 'Iman yang menghormati',
    place: '15 Ulu, Jakabaring',
    clock: '06.30',
    story: [
      'Dari tepian Jakabaring, dua menara merah bersusun lima terlihat di atas atap rumah warga. Bentuknya mirip pagoda, padahal keduanya menara masjid. Inilah Masjid Al-Islam Muhammad Cheng Ho Sriwijaya, didirikan oleh Persatuan Islam Tionghoa Indonesia (PITI) dan dipakai sejak 2008.',
      'Namanya mengenang Laksamana Cheng Ho, utusan Dinasti Ming yang beragama Islam dan disebut tiga kali singgah di Palembang dalam pelayarannya. Bangunannya memadukan gaya kelenteng, kubah hijau dengan bulan sabit dan bintang, serta atap limas khas rumah Palembang di keempat sudutnya.',
      'Sila pertama mengajak kita beriman kepada Tuhan sambil menghormati cara orang lain beribadah. Masjid ini memperlihatkan bahwa orang bisa memeluk agamanya dengan sungguh-sungguh tanpa meninggalkan budaya asalnya.',
    ],
    note: 'Lima tingkat pada tiap menaranya sering dikaitkan dengan lima waktu salat.',
    action: 'Telusuri tiga akar',
    actionHint: 'Pilih satu akar budaya untuk menyalakan bagian bangunan yang berasal darinya.',
    reflect: 'Adakah tempat ibadah di sekitarmu yang memadukan budaya lain? Apa yang membuatnya diterima warga?',
    sources: [
      { label: 'Handayani dkk. (2026). Cheng Ho Mosque of Palembang as a Symbol of Cultural Acculturation. ELS Journal on Interdisciplinary Studies in Humanities, 9(3).', url: 'https://journal.unhas.ac.id/index.php/jish/article/view/53217' },
      { label: 'Pulungan, J. S. Dinamika Kebudayaan Islam Melayu di Nusantara: Masjid Cheng Ho di Palembang. Tamaddun, UIN Raden Fatah.', url: 'https://jurnal.radenfatah.ac.id/index.php/tamaddun/article/view/2517' },
      { label: 'TIMES Indonesia. Melirik Sejarah dan Daya Tarik Masjid Muhammad Cheng Hoo Palembang.', url: 'https://timesindonesia.co.id/wisata/578511/melirik-sejarah-dan-daya-tarik-masjid-muhammad-cheng-hoo-palembang' },
    ],
  },
  {
    id: 'dermaga-2',
    num: 2,
    roman: 'II',
    title: 'Delapan di Atas Sepra',
    sila: 'Kemanusiaan yang Adil dan Beradab',
    silaShort: 'Sila kedua',
    value: 'Adil di satu hidangan',
    place: 'Seberang Ulu, rumah rakit',
    clock: '08.30',
    story: [
      'Di beranda rumah rakit ini sebuah idangan sedang disiapkan. Dalam tradisi ngobeng, delapan tamu duduk bersila mengelilingi sepra, kain alas makan yang dihampar di lantai. Nasi minyak diletakkan di tengah, sedangkan lauk-pauk ditata berpasangan di sekelilingnya.',
      'Penataan itu ada aturannya. Lauk disusun silang supaya setiap tamu bisa mengambil semua jenis lauk tanpa tangannya melintas di depan orang lain, karena hal itu dianggap pamali. Yang paling tua dipersilakan mengambil lebih dulu. Orang yang melayani tamu disebut obeng.',
      'Sila kedua berbicara tentang adil dan beradab. Di atas sepra, adil berarti semua tamu kebagian, dan beradab berarti tahu kapan harus menunggu.',
    ],
    note: 'Angka delapan sering dimaknai sebagai pembagian hari: delapan jam untuk ibadah, delapan jam untuk bekerja, dan delapan jam untuk beristirahat.',
    action: 'Tata idangan',
    actionHint: 'Pindahkan delapan piring lauk dari nampan ke lingkaran sepra. Setiap tamu harus bisa menjangkau keempat jenis lauk dari tempat duduknya.',
    reflect: 'Pernahkah kamu makan bersama dari satu hidangan? Kebiasaan apa yang membuat semua orang merasa dihormati?',
    sources: [
      { label: 'Rohmadi dkk. (2025). The Ngobeng Tradition in Palembang. Muslim Heritage, 10(1).', url: 'https://jurnal.iainponorogo.ac.id/index.php/muslimheritage/article/download/10874/3957/33323' },
      { label: 'Mariyani, Rahmat, Fatiha (2025). Eksplorasi Eksistensi Tradisi Ngidang-ngobeng dalam Perspektif Civic Culture Generasi Muda Palembang. Jurnal Humanitas, 11(4).', url: 'https://e-journal.hamzanwadi.ac.id/index.php/jhm/article/download/32193/7740/201360' },
      { label: 'Amanda & Suyato (2026). Civic Culture dalam Ngidang Ngobeng sebagai Sumber Pembelajaran PPKn. Jurnal PEKAN, 11(1).', url: 'https://jurnal.stkippersada.ac.id/jurnal/index.php/PEKAN/article/view/6445' },
    ],
  },
  {
    id: 'dermaga-3',
    num: 3,
    roman: 'III',
    title: 'Dua Kampung, Satu Cuko',
    sila: 'Persatuan Indonesia',
    silaShort: 'Sila ketiga',
    value: 'Bersatu tanpa melebur',
    place: '7 Ulu dan 13 Ulu',
    clock: '11.30',
    story: [
      'Seberang Ulu menyimpan dua kampung tua di tepi Musi. Kampung Kapitan di 7 Ulu menjadi permukiman warga Tionghoa, dan Rumah Kapitan di sana memadukan gaya lokal, Tionghoa, dan kolonial. Agak ke hilir, Kampung Al-Munawar di 13 Ulu dihuni keturunan Arab. Rumah-rumahnya ada yang berupa rumah panggung beratap limas, ada pula rumah dua lantai berjendela krepyak.',
      'Di Kampung Kapitan, warga mengenal ungkapan wong Cino wong kito, artinya orang Tionghoa juga orang kita. Ungkapan seperti ini dipakai dalam pergaulan sehari-hari dan ikut menjaga kerukunan.',
      'Pempek lahir dari pertemuan serupa. Ikan sungai dan sagu dari dapur Melayu bertemu cara mengolah ikan yang dibawa warga Tionghoa. Menurut cerita yang beredar, nama pempek berasal dari panggilan "apek" kepada lelaki Tionghoa yang menjajakannya.',
      'Sila ketiga tidak meminta orang melupakan asal-usulnya. Kedua kampung ini tetap punya ciri masing-masing, dan keduanya sama-sama bagian dari Palembang.',
    ],
    note: 'Pempek tercatat sebagai Warisan Budaya Takbenda Indonesia sejak 2014.',
    action: 'Kunjungi dua kampung',
    actionHint: 'Lihat ciri rumah di tiap kampung, lalu masak pempek kapal selam dari ikan sampai cuko.',
    reflect: 'Makanan apa di daerahmu yang lahir dari pertemuan dua budaya?',
    sources: [
      { label: 'Yusalia, H. (2024). Ethics of Intercultural Communication among Ethnic Chinese in Kampung Kapitan Palembang. Jurnal Studi Sosial dan Politik, 8(1).', url: 'https://jurnal.radenfatah.ac.id/index.php/jssp/article/download/22258/7343/72613' },
      { label: 'Wujud Akulturasi Arsitektur Rumah Tinggal Etnis Arab di Kampung Al-Munawar 13 Ulu Palembang. Arsitektura, UNS.', url: 'https://jurnal.uns.ac.id/Arsitektura/article/view/84006' },
      { label: 'Afni & Hasaniyah (2025). Warisan Kuliner Pempek: Perpaduan Budaya Melayu dan Tionghoa di Kota Palembang. Maliki Interdisciplinary Journal, 3(3).', url: 'https://urj.uin-malang.ac.id/index.php/mij/article/download/13014/4423' },
    ],
  },
  {
    id: 'dermaga-4',
    num: 4,
    roman: 'IV',
    title: 'Cahaya dari Ratu Sinuhun',
    sila: 'Kerakyatan yang Dipimpin oleh Hikmat Kebijaksanaan dalam Permusyawaratan/Perwakilan',
    silaShort: 'Sila keempat',
    value: 'Mufakat lewat musyawarah',
    place: 'Balai di tepian',
    clock: '16.30',
    story: [
      'Sungai Musi mengalir dari uluan, daerah pedalaman Sumatera Selatan. Di sana pernah berlaku Undang-Undang Simbur Cahaya, kitab hukum adat yang dikaitkan dengan Ratu Sinuhun, permaisuri penguasa Palembang pada abad ke-17. Isinya memadukan adat yang berkembang secara lisan dengan ajaran Islam.',
      'Kitab ini terdiri atas lima bab, mulai dari adat bujang gadis dan perkawinan sampai aturan dusun dan berladang. Simbur cahaya berarti percikan sinar, sebuah suluh untuk menerangi kehidupan bersama.',
      'Aturan yang ditulis dan disepakati membuat sengketa tidak diputus oleh pihak yang paling kuat. Sila keempat meminta hal yang sama: keputusan bersama diambil lewat musyawarah, dengan menimbang pendapat semua pihak secara bijak.',
    ],
    note: 'Kitab ini menjadi pegangan di daerah uluan selama berabad-abad, sampai pemerintahan marga dihapus pada 1979.',
    action: 'Selesaikan sengketa',
    actionHint: 'Dua keluarga berselisih soal batas ladang. Pilih cara penyelesaiannya.',
    reflect: 'Kapan terakhir kali kamu ikut memutuskan sesuatu bersama orang lain? Apakah semua orang sempat bicara?',
    sources: [
      { label: 'Annisa, Idris, Sholeh (2021). Analisis Konsep Gender dalam Undang-Undang Simbur Cahaya sebagai Sumber Pembelajaran Sejarah. Kalpataru, 7(1).', url: 'https://jurnal.univpgri-palembang.ac.id/index.php/Kalpa/article/view/6276' },
      { label: 'Farida & Hasan, Y. Undang-Undang Simbur Cahaya sebagai Sumber Hukum di Kesultanan Palembang. Repositori Universitas Sriwijaya.', url: 'https://repository.unsri.ac.id/25297/1/Undang_Undang_Simbur_Cahaya.pdf' },
      { label: 'Husna, Alfiandra, Waluyati. Analisis Nilai-nilai dalam Undang-Undang Simbur Cahaya pada Masyarakat Ogan Ilir. Jurnal Civics, UNY.', url: 'https://journal.uny.ac.id/index.php/civics/article/download/19237/pdf' },
    ],
  },
  {
    id: 'dermaga-5',
    num: 5,
    roman: 'V',
    title: 'Amanat di Atas Musi',
    sila: 'Keadilan Sosial bagi Seluruh Rakyat Indonesia',
    silaShort: 'Sila kelima',
    value: 'Maju di kedua tepi',
    place: 'Jembatan Ampera',
    clock: '19.30',
    story: [
      'Gagasan menyatukan Seberang Ilir dan Seberang Ulu dengan jembatan sudah muncul sejak 1906. Pembangunannya baru dimulai pada April 1962 dengan dana pampasan perang dari Jepang, dan jembatan ini diresmikan pada 10 November 1965.',
      'Mula-mula namanya Jembatan Bung Karno. Pada masa Orde Baru namanya diganti menjadi Ampera, singkatan dari Amanat Penderitaan Rakyat. Jembatan ini dibangun supaya kemajuan tidak hanya dirasakan satu sisi kota.',
      'Bagian tengahnya dulu bisa diangkat agar kapal tinggi bisa lewat, tetapi sejak 1970 tidak lagi dinaikkan. Pada 1990 bandul pemberatnya diturunkan demi keamanan.',
      'Sila kelima menuntut keadilan yang sampai ke semua orang. Nama Ampera mengingatkan bahwa pembangunan adalah amanat rakyat, untuk warga di kedua tepi sungai.',
    ],
    note: 'Sejak 2018 menara Ampera dipasangi jam analog berdiameter sekitar 5,5 meter. Jam pada model ini mengikuti waktu di perangkatmu.',
    action: 'Buka jembatan waktu',
    actionHint: 'Geser tahun untuk melihat Ampera dibangun, lalu nyalakan lampunya dengan dermaga yang sudah kamu singgahi.',
    reflect: 'Jembatan apa yang masih dibutuhkan di sekitarmu supaya keadilan terasa merata?',
    sources: [
      { label: 'Aryanti, Putri, Syarifuddin, Irwanto (2022). Sejarah Jembatan Ampera sebagai Ikon Kota Palembang. Historia Madania, 6(2).', url: 'https://journal.uinsgd.ac.id/index.php/historia/article/download/18548/7909' },
      { label: 'Ampera Bridge. Wikipedia.', url: 'https://en.wikipedia.org/wiki/Ampera_Bridge' },
      { label: 'Kementerian PU, Ditjen Bina Marga. Evaluasi Struktur Jembatan Ampera sebagai Upaya Awal Pelestarian Aset Heritage Kota Palembang.', url: 'https://binamarga.pu.go.id/index.php/article/evaluasi-struktur-jembatan-ampera-sebagai-upaya-awal-pelestarian-aset-heritage-kota-palembang' },
      { label: 'Sekretariat Kabinet RI (2018). Dipasang Jam Analog pada Menara, Pemerintah Rehabilitasi Jembatan Ampera.', url: 'https://setkab.go.id/?p=134813' },
      { label: 'ANTARA (2026). Ampera Bridge designated as national cultural heritage site.', url: 'https://en.antaranews.com/news/431023/ampera-bridge-designated-as-national-cultural-heritage-site' },
    ],
  },
];

// Tiga akar Masjid Cheng Ho untuk interaksi Dermaga I.
export const roots = [
  {
    id: 'tionghoa',
    label: 'Tionghoa',
    text: 'Dua menara segi delapan bersusun lima dengan ujung atap yang melengkung ke atas, gapura yang mirip kelenteng, pilar merah, serta warna merah dan hijau giok.',
  },
  {
    id: 'arab',
    label: 'Timur Tengah',
    text: 'Kubah hijau berhias bulan sabit dan bintang, bukaan pintu dan jendela berbentuk lengkung, serta ornamen geometris. Kaligrafi Arab juga menghiasi bagian dalam dan luar bangunan.',
  },
  {
    id: 'palembang',
    label: 'Palembang',
    text: 'Atap limas di keempat sudut bangunan, bentuk atap yang juga dipakai rumah adat Palembang, dan ornamen tanduk kambing di bagian luar menara.',
  },
] as const;

// Empat jenis lauk (iwak) untuk teka-teki Dermaga II.
export const iwak = [
  { id: 'malbi', label: 'Malbi', desc: 'daging sapi masak kecap dan rempah' },
  { id: 'gulai', label: 'Gulai ayam', desc: 'ayam berkuah kuning' },
  { id: 'pindang', label: 'Pindang ikan', desc: 'ikan berkuah asam pedas dengan nanas' },
  { id: 'sate', label: 'Sate', desc: 'tusukan daging bakar' },
] as const;

// Langkah dapur pempek di Dermaga III.
export const dapur = [
  { id: 'ikan', label: 'Ikan', text: 'Masukkan daging ikan giling ke baskom. Dulu orang memakai ikan belida, sekarang tenggiri lebih sering dipakai.' },
  { id: 'sagu', label: 'Sagu', text: 'Tambahkan sagu. Tanaman sagu sudah dikenal di Palembang sejak lama.' },
  { id: 'uleni', label: 'Uleni', text: 'Aduk dan uleni sampai adonan kalis.' },
  { id: 'telur', label: 'Isi telur', text: 'Bentuk adonan menjadi kantong, lalu isi dengan telur. Bentuk inilah yang disebut kapal selam.' },
  { id: 'goreng', label: 'Goreng', text: 'Rebus lalu goreng sampai kulitnya kecokelatan.' },
  { id: 'cuko', label: 'Sajikan', text: 'Potong dan siram dengan cuko, kuah gula aren yang pedas dan asam, lalu taburi timun.' },
] as const;

// Pilihan penyelesaian sengketa di Dermaga IV. Kisahnya ilustrasi.
export const sengketa = {
  intro: 'Dua keluarga di sebuah dusun berselisih soal batas ladang setelah patok lama hanyut terbawa banjir. Masing-masing yakin batasnya ada di tempat yang berbeda.',
  choices: [
    {
      id: 'sepihak',
      label: 'Biarkan kepala dusun memutuskan sendiri, supaya cepat selesai.',
      result: 'Perkaranya cepat selesai, tetapi satu keluarga merasa tidak didengar. Keputusan sepihak seperti ini mudah memancing sengketa baru.',
      good: false,
    },
    {
      id: 'voting',
      label: 'Tanyai seluruh warga dusun, lalu ambil suara terbanyak.',
      result: 'Suara terbanyak sah dipakai bila mufakat buntu. Namun kedua keluarga belum sempat menjelaskan duduk perkaranya, jadi warga memilih tanpa tahu persoalannya.',
      good: false,
    },
    {
      id: 'musyawarah',
      label: 'Kumpulkan kedua keluarga di balai bersama tetua, dengarkan semua pihak, lalu cari jalan tengah.',
      result: 'Kedua keluarga bercerita, tetua menimbang, dan patok baru dipasang di tempat yang disetujui bersama. Begitulah musyawarah untuk mufakat bekerja.',
      good: true,
    },
  ],
  bab: [
    ['Adat Bujang Gadis dan Kawin', '32 pasal'],
    ['Adat Perhukuman', '58 pasal'],
    ['Adat Marga', '29 pasal'],
    ['Aturan Kaum', '19 pasal'],
    ['Aturan Dusun dan Berladang', '32 pasal'],
  ],
} as const;

// Garis waktu Jembatan Ampera untuk Dermaga V.
export const timeline = [
  { year: 1906, text: 'Gagasan jembatan penghubung Ilir dan Ulu muncul pada masa Gemeente Palembang.' },
  { year: 1924, text: 'Wali Kota Le Cocq de Ville menghidupkan lagi gagasan itu, tetapi tidak terwujud sampai Belanda pergi.' },
  { year: 1956, text: '29 Oktober 1956: rapat membahas rancangan jembatan di atas Sungai Musi.' },
  { year: 1962, text: 'April 1962: pembangunan dimulai dengan dana pampasan perang dari Jepang.' },
  { year: 1965, text: '10 November 1965: jembatan diresmikan dengan nama Jembatan Bung Karno. Bagian tengahnya bisa diangkat setinggi kapal.' },
  { year: 1966, text: 'Namanya diganti menjadi Jembatan Ampera, Amanat Penderitaan Rakyat.' },
  { year: 1970, text: 'Bagian tengah tidak lagi diangkat karena proses mengangkatnya dianggap menghambat lalu lintas.' },
  { year: 1990, text: 'Dua bandul pemberat, masing-masing sekitar 500 ton, diturunkan demi keamanan.' },
  { year: 2018, text: 'Jam analog berdiameter sekitar 5,5 meter dipasang di menara.' },
  { year: 2026, text: 'Pemerintah menetapkan Jembatan Ampera sebagai cagar budaya nasional.' },
] as const;
