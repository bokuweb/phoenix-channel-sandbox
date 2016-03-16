ExUnit.start

Mix.Task.run "ecto.create", ~w(-r PhoenixChannelSandbox.Repo --quiet)
Mix.Task.run "ecto.migrate", ~w(-r PhoenixChannelSandbox.Repo --quiet)
Ecto.Adapters.SQL.begin_test_transaction(PhoenixChannelSandbox.Repo)

