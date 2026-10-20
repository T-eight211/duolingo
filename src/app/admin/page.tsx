import { getIsAdmin } from "@/db/queries";
import App from "./client";
import { redirect } from "next/navigation";


const AdminPage = async () => {
  const isAdmin = await getIsAdmin();

  if (!isAdmin) {
    redirect("/");
  }

  return <App />;
};

export default AdminPage;
