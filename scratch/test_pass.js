const bcrypt = require('bcryptjs');

const users = [
  { name: "System Admin", email: "admin@handoverly.com", hash: "$2b$10$i.oaDOvAjv.eaTfiCghQUubDjIABLWVYklgnHoxYr5.C0EoeGiGx2" },
  { name: "MD Koishiqur Rahman", email: "md@kh.com", hash: "$2b$10$/yjt9ZZnatL0Sd.8lJRBDO.rLxlTAxgHpHVf0jAxWMuNrAZODKr7K" },
  { name: "Kaylie", email: "kaylie@hahndorf.com", hash: "$2b$10$St8K2AB2YIkbnlrxud/FLO7wYMKZ1FGtuCXhoVbDxyf6yRl80IpEO" },
  { name: "Jane austen", email: "jane@facility.com", hash: "$2b$10$KrXttE/xNTcLdWralzzhgur2bcSTPVQjRtK8U78wbxSXiwgy3w91G" },
  { name: "MD Koishiqur", email: "md@hahndorf.com", hash: "$2b$10$9pUy871zjlceWAIoEc13u.BJxQWG5MdnmijPOJcU83qlIuAokg9Q6" }
];

const candidates = ["1111", "2222", "3333", "123456", "password123", "admin", "admin123", "password", "292933", "232312", "62663", "89233"];

for (const user of users) {
  let found = false;
  for (const cand of candidates) {
    if (bcrypt.compareSync(cand, user.hash)) {
      console.log(`User ${user.email} (${user.name}): MATCH FOUND -> ${cand}`);
      found = true;
      break;
    }
  }
  if (!found) {
    console.log(`User ${user.email} (${user.name}): NO MATCH FOUND`);
  }
}
