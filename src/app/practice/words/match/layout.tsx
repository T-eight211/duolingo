type Props = {
  children: React.ReactNode;
};

const PracticeMatchingLayout = ({ children }: Props) => {
  return (
    <div className="flex h-full min-h-screen flex-col bg-white">
      <div className="flex h-full w-full flex-col">{children}</div>
    </div>
  );
};

export default PracticeMatchingLayout;
