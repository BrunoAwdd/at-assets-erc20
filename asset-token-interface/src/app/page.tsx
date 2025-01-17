export default async function ApproveNewUserPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-white">
      <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold">Welcome to AT Token Interface!</h1>
        <p className="mt-4 text-lg">
          Manage your ERC-20 tokens quickly and securely.
        </p>
        <p className="mt-4 text-md text-gray-400 underline">
          To access the token, click on the provided link.
        </p>
      </div>
    </main>
  );
}
