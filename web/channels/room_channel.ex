defmodule PhoenixChannelSandbox.RoomChannel do
  use PhoenixChannelSandbox.Web, :channel

  def join("rooms:join", message, socket), do: {:ok, socket}
end
