const Break = ({ breakTime }: { breakTime: number }) => {
  return (
    <div className="mt-4 mb-2 text-sm">
  <span className="">Break length: </span>{" "}
      <span>{formatMinuteText(breakTime)}</span>
    </div>
  );
};

function formatMinuteText(breakTime: number) {
  if (breakTime !== 1) return `${breakTime} minutes`;
  return `${breakTime} minute`;
}

export default Break;
