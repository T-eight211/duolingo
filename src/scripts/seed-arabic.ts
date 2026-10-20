import "dotenv/config";
import { client } from "../db/drizzle";
import { seedArabicCourse } from "../db/seed-arabic";

seedArabicCourse()
  .then((course) =>
    console.log(
      `Arabic course ready (ID ${course.id}): 3 lessons, 12 challenges.`,
    ),
  )
  .catch((error) => {
    console.error("Could not add Arabic:", error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
