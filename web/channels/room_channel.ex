defmodule PhoenixChannelSandbox.RoomChannel do
  use PhoenixChannelSandbox.Web, :channel

  def join("rooms:join", message, socket), do: {:ok, socket}

  def handle_in("new:message", message, socket) do
    broadcast! socket, "new:reply", %{msg: message["msg"]}
    {:noreply, socket}
  end
end
